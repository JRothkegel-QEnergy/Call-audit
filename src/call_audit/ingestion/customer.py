"""Ficha del cliente: datos del titular y del seguro que vienen en la metadata del lote (Cambio 13, D-43).

Se muestran completos a auditor, supervisor y admin (D-41, D-44) y no van al modelo: no entran a `input_data` ni a
ningún prompt. Nada de estos valores se loguea; se loguea el `call_id`.

Un valor que no se puede interpretar (fecha o RUT inválidos) se guarda tal como viene: no se oculta ni se corrige.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any


def clean(value: Any) -> str:
    """Igual que real_calls.clean: sin espacios de más ni no separables."""
    return " ".join(str(value or "").replace(" ", " ").split())


YES = {"SI", "SÍ", "S", "1", "TRUE", "VERDADERO", "X"}
NO = {"NO", "N", "0", "FALSE", "FALSO"}


def column(row: dict, *names: str) -> Any:
    """El primer nombre que traiga la fila. La planilla trae «COMPAÑIA» con la Ñ dañada y «MATENRO» por «MATERNO»."""
    for name in names:
        if name in row:
            return row[name]
    for key, value in row.items():
        if any(re.fullmatch(name.replace("Ñ", "."), str(key)) for name in names if "Ñ" in name):
            return value
    return None


def text(value: Any) -> str | None:
    return clean(value) or None


def day(value: Any) -> str | None:
    """dd-mm-aaaa; si no es fecha, como viene."""
    if isinstance(value, datetime | date):
        return value.strftime("%d-%m-%Y")
    return text(value)


def rut(number: Any, dv: Any) -> str | None:
    """12.345.678-5. El DV puede venir aparte (columna DV) o pegado con guion. Sin número válido, lo que venga."""
    raw, check = clean(number), clean(dv).upper()
    if not check and re.fullmatch(r"[\d.]+-[\dkK]", raw):
        raw, check = raw.rsplit("-", 1)[0], raw[-1].upper()
    digits = re.sub(r"\D", "", raw) if re.fullmatch(r"[\d.\s]+", raw) else ""
    if not digits:
        return " ".join(x for x in (clean(number), check) if x) or None
    grouped = f"{int(digits):,}".replace(",", ".")
    return f"{grouped}-{check}" if check else grouped


def phone(value: Any) -> str | None:
    """Celular chileno como +56 9 1234 5678 (con o sin el 56 adelante). Otro formato, como viene."""
    raw = clean(value)
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits.startswith("569"):
        digits = digits[2:]
    if len(digits) == 9 and digits.startswith("9"):
        return f"+56 9 {digits[1:5]} {digits[5:]}"
    return raw or None


def yes_no(value: Any) -> str | None:
    """Sí / No cuando se reconoce; si no, como viene (H-74)."""
    raw = clean(value)
    if raw.upper() in YES:
        return "Sí"
    if raw.upper() in NO:
        return "No"
    return raw or None


def customer(row: dict) -> dict | None:
    """Datos del titular. None si la fila no trae ninguno."""
    name = " ".join(clean(column(row, k)) for k in ("NOMBRE", "PATERNO") if clean(column(row, k)))
    maternal = clean(column(row, "MATERNO", "MATENRO"))
    out = {
        "full_name": " ".join(x for x in (name, maternal) if x) or None,
        "rut": rut(column(row, "RUT"), column(row, "DV")),
        "birth_date": day(column(row, "FECHA_NACIMIENTO")),
        "email": (text(column(row, "EMAIL")) or "").lower() or None,
        "phone": phone(column(row, "FONO_CONTACTO")),
        "flow": text(column(row, "FLUJO")),
    }
    return out if any(out.values()) else None


def policy_metadata(row: dict) -> dict:
    """Lo del seguro que viene en la fila y la ficha muestra junto a su pestaña."""
    return {
        "insurer": text(column(row, "COMPAÑIA", "COMPANIA")),
        "insurance_type": text(column(row, "TIPO_SEGURO")),
        "sale_date": day(column(row, "FECHA_VENTA_SEGURO")),
        "renounceable": yes_no(column(row, "RENUNCIABLE")),
        "retainable": yes_no(column(row, "RETENIBLE")),
    }


# Lo esperado según la categoría de la ficha (§1.2 del Cambio 13). NO_RENUNCIABLE_* no compara retenible.
EXPECTED = {"RETENIBLE": ("Sí", "Sí"), "NO RETENIBLE": ("Sí", "No")}


def category_mismatch(category: str, renounceable: str | None, retainable: str | None) -> list[dict]:
    """Campos de la metadata que contradicen la categoría de la ficha. Informativo: no cambia el veredicto."""
    key = category.replace("_", " ").upper().strip()
    if key in EXPECTED:
        expected = dict(zip(("renounceable", "retainable"), EXPECTED[key], strict=True))
    elif key.startswith("NO RENUNCIABLE") or key == "IRRENUNCIABLE":
        expected = {"renounceable": "No"}
    else:
        return []
    values = {"renounceable": renounceable, "retainable": retainable}
    return [
        {"field": field, "metadata": values[field]}
        for field, want in expected.items()
        if values[field] in ("Sí", "No") and values[field] != want
    ]


CALL_DATA = [
    ("Compañía", "insurer"),
    ("Tipo de seguro", "insurance_type"),
    ("Fecha de venta", "sale_date"),
]
CALL_DATA_LABELS = {label for label, _ in CALL_DATA}


def enrich_sheet(sheet: dict, row: dict, has_product: bool) -> dict:
    """La ficha de la pestaña con lo de la metadata. Idempotente: se puede volver a aplicar en la reimportación."""
    meta = policy_metadata(row)
    out = dict(sheet)
    rows = [r for r in out.get("callData") or [] if r["label"] not in CALL_DATA_LABELS]
    out["callData"] = rows + [{"label": label, "value": meta[key]} for label, key in CALL_DATA if meta[key]]
    category = {"renounceable": meta["renounceable"], "retainable": meta["retainable"]}
    out["customerCategory"] = category if any(category.values()) else None
    out["categoryMismatch"] = (
        category_mismatch(out.get("category") or "", meta["renounceable"], meta["retainable"]) if has_product else []
    )
    return out


CRITERIA_COUNT = 33


def client_fails(row: dict) -> list[int] | None:
    """Motivos que el auditor del cliente marcó NO CUMPLE (Cambio 15, D-55): las 33 columnas de motivos que siguen a
    RETENIBLE, en el orden de la pauta (C01..C33), como client_bad() del dashboard local. Los motivos vienen con su
    nombre ("Induce a renuncia"); se saltan las columnas de datos sin espacios, porque el Excel nuevo de S4P trae
    EVALUADOR_CALIDAD entre RETENIBLE y los motivos. None si el Excel no trae esas columnas o vienen todas vacías (una
    llamada que el cliente no auditó)."""
    keys = list(row)
    if "RETENIBLE" not in keys:
        return None
    after = keys[keys.index("RETENIBLE") + 1 :]
    cols = [k for k in after if " " in str(k).strip()][:CRITERIA_COUNT]
    if len(cols) < CRITERIA_COUNT or not any(clean(row[k]) for k in cols):
        return None
    return [i for i, k in enumerate(cols, 1) if clean(row[k]).upper() == "NO CUMPLE"]


def apply(case: Any, row: dict) -> None:
    """Guarda la ficha del cliente y la marca del cliente por motivo en el caso, y completa sus fichas de seguro. No
    toca corridas ni revisiones."""
    case.call_metadata = {**(case.call_metadata or {}), "customer": customer(row)}
    case.product_sheets = [enrich_sheet(s, row, bool(s.get("productId"))) for s in case.product_sheets or []]
    case.external_item_fails = client_fails(row)


def backfill(session: Any, rows: dict[str, dict]) -> tuple[int, int]:
    """Completa las llamadas ya importadas con su metadata (D-46). Sin ASR ni LLM. Devuelve (actualizadas, sin fila)."""
    from sqlalchemy import select

    from call_audit.persistence.models import Case

    updated = missing = 0
    for case in session.scalars(select(Case)):
        row = rows.get(case.recording or "")
        if row is None:
            missing += 1
            continue
        apply(case, row)
        updated += 1
    return updated, missing


def main() -> None:
    """uv run python -m call_audit.ingestion.customer --metadata "../audios/Retenciones BECS Para Revision.xlsx"

    Vuelve a leer la metadata de los lotes ya importados y guarda la Ficha del cliente y la marca del cliente por
    motivo (Cambio 15). No transcribe ni llama al modelo, y no toca validaciones, revisiones ni versiones. Se puede
    correr más de una vez.
    """
    import argparse
    from pathlib import Path

    from sqlalchemy import select

    from call_audit.ingestion.import_bench import real_calls
    from call_audit.persistence.db import get_sessionmaker
    from call_audit.persistence.models import Case

    parser = argparse.ArgumentParser(description=main.__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--metadata", type=Path, action="append", required=True, help="Excel del lote (repetible)")
    args = parser.parse_args()
    rows: dict[str, dict] = {}
    for path in args.metadata:
        rows.update(real_calls.load_rows(path))
    with get_sessionmaker()() as session, session.begin():
        updated, missing = backfill(session, rows)
        marked = sum(1 for c in session.scalars(select(Case)) if c.external_item_fails is not None)
    print(f"{updated} llamadas con la Ficha del cliente ({marked} con marca por motivo); {missing} sin fila")


if __name__ == "__main__":
    main()
