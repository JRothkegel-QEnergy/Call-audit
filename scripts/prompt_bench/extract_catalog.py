"""Arma el catálogo de seguros a partir del Excel de apoyo del cliente ("Apoyo nuevo v1.xlsb").

Uso:
    pip install pyxlsb
    python scripts/prompt_bench/extract_catalog.py "<ruta>/Apoyo nuevo v1.xlsb"

Escribe data/catalog/products.json (data/ está en .gitignore: es material del cliente, no va al repo).

Qué sale de dónde:
- Nombre, compañía y categoría (retenible / no retenible / no renunciable): hoja RESUMEN. El nombre es el mismo
  que viene en los metadatos de BancoEstado, así que sirve para hacer el match con la llamada.
- Tipo de prima: columna "mensuales / anuales / Credito" de RESUMEN (MetLife) o el título de la ficha
  ("Prima Única" / "Prima Recurrente"). Si no se dice, queda "sin_dato".
- Ficha: todo el texto de la hoja del producto (el link "Pinchar aquí" de RESUMEN). El mapeo nombre → hoja
  está escrito a mano abajo porque pyxlsb no lee los hipervínculos.
- Procedimientos (cliente fallecido, retracto, devoluciones, etc.) y medios de pago: hoja Otros.
"""

import json
import sys
from pathlib import Path

from pyxlsb import open_workbook

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "catalog" / "products.json"

# (nombre en RESUMEN / metadatos, compañía, categoría, tipo de prima, hoja de la ficha o None)
# Categorías: RETENIBLE · NO_RETENIBLE (se puede renunciar, no se retiene) ·
#             NO_RENUNCIABLE_SUCURSAL · NO_RENUNCIABLE_COSTO_BANCO · NO_RENUNCIABLE_OBLIGATORIO
# Tipo de prima de MetLife según la columna de RESUMEN: filas 3-9 "mensuales", 10-16 "anuales", 17-31 "Credito".
PRODUCTS = [
    # MetLife retenibles
    ("SONAP", "MetLife", "RETENIBLE", "mensual", None),
    ("SONAP TITULAR", "MetLife", "RETENIBLE", "mensual", "SONAP TITULAR"),
    ("SONAP CARGAS", "MetLife", "RETENIBLE", "mensual", "SONAP CARGAS"),
    ("RENTA DIARIA TELEMARKETING", "MetLife", "RETENIBLE", "mensual", "RENTA DIARIA"),
    ("HOSPITALIZACION TLMK", "MetLife", "RETENIBLE", "mensual", "HOSPITALIZACIÓN"),
    ("SEGURO ENFERMEDADES GRAVES", "MetLife", "RETENIBLE", "mensual", "ENFERMEDADES GRAVES "),
    ("AP + AHORRO TLMK - ACCIDENTES PERSONALES CON AHORRO", "MetLife", "RETENIBLE", "mensual", "AP + AHORRRO TLMK"),
    ("AP INDIVIDUAL MEDIO DE PAGO", "MetLife", "RETENIBLE", "anual", "AP INDIVIDUAL "),
    ("AP PLUS MEDIO DE PAGO", "MetLife", "RETENIBLE", "anual", "AP PLUS "),
    ("AP. PLAN INDIVIDUAL", "MetLife", "RETENIBLE", "anual", "ACCIDENTES PERSONALES PLAN IND"),
    ("AP. PLAN PLUS", "MetLife", "RETENIBLE", "anual", "ACCIDENTES PERSONALES PLAN PLUS"),
    ("SEGURO INCREIBLE PLUS", "MetLife", "RETENIBLE", "anual", "AP PLUS "),
    ("ACCIDENTE PERSONAL FULL MP", "MetLife", "RETENIBLE", "anual", "ACCIDENTES PERSONALES PLAN FULL"),
    ("ESTUDIO SEGURO", "MetLife", "RETENIBLE", "anual", "ESTUDIO SEGURO"),
    ("DES CONSUMO CONVENIO ESPECIAL", "MetLife", "RETENIBLE", "credito", "SEGURO CONVENIOS ESPECIALES "),
    ("VIDA E INVALIDEZ METLIFE", "MetLife", "RETENIBLE", "credito", "VIDA E INV. TOTAL PERMANENTE"),
    ("SEGURO MAXIMA PROTECCION", "MetLife", "RETENIBLE", "credito", "MAXIMA PROTECCIÓN"),
    ("SEG ACCIDENTAL PESCADORES 1", "MetLife", "RETENIBLE", "credito", "AP PESCADOR PLAN 1"),
    ("SEG ACCIDENTAL PESCADORES 2", "MetLife", "RETENIBLE", "credito", "AP PESCADOR PLAN 2"),
    ("ENF GRAV ITP SALUDMICRO", "MetLife", "RETENIBLE", "credito", "SALUD MICROEMPRESA "),
    ("SEGURO DESGRAVAMEN CED PROT CO1", "MetLife", "RETENIBLE", "credito", "SEGURO CREDITO PROTEGIDO I"),
    ("SEGURO DESGRAVAMEN CED PROT CO 2", "MetLife", "RETENIBLE", "credito", "SEGURO CREDITO PROTEGIDO II "),
    ("SEGURO DESGRAVAMEN PEQ EMPRESA", "MetLife", "RETENIBLE", "credito", "DESGRAVAMEN MICROEMPRESA"),
    ("DESGRAVAMEN PYMES", "MetLife", "RETENIBLE", "credito", "DESGRAVAMEN PYMES"),
    ("DESGRAVAMEN CRED. UNIVERSITARIOS", "MetLife", "RETENIBLE", "credito", "DESGRAVAMEN CRED. UNIVERSITARIO"),
    ("Enfermedades Grav. Cre Consumo", "MetLife", "RETENIBLE", "credito", "COBERTURA POR EGRA"),
    ("SEGURO COBERTURA POR FALLECIMI", "MetLife", "RETENIBLE", "credito", "COBERTURA POR FALLECIMIENTO"),
    ("SEGURO PROTECCION DESG", "MetLife", "RETENIBLE", "credito", "SEGURO PROTECCIÓN"),
    ("Desgravamen Plus Cre. Consumo", "MetLife", "RETENIBLE", "credito", "COLECTIVO DESGRAVAMEN"),
    # Cardif retenibles (tipo de prima según el título de la ficha)
    ("DESEMP E INCAPACID TEM (Hipotecario)", "BNP Paribas Cardif", "RETENIBLE", "mensual", "Des e IT Credito Hip No subsid."),
    ("DESEMPLEO ITT CRE. CONSUMO", "BNP Paribas Cardif", "RETENIBLE", "credito", "Des e IT Credito Consumo"),
    ("DES ITT CRED CONSUMO PROT", "BNP Paribas Cardif", "RETENIBLE", "credito", "Des e IT Consumo Protegido"),
    ("INCAP TEMP SALUDMICRO", "BNP Paribas Cardif", "RETENIBLE", "credito", "Incap. Temporal Salud Micro"),
    ("SALE SEGURO PLUS (Sucursales)", "BNP Paribas Cardif", "RETENIBLE", "mensual", "Sale Seguro Plus"),
    ("PROTECCION GLOBAL MYPE", "BNP Paribas Cardif", "RETENIBLE", "mensual", "Protección Global MYPE"),
    # Sura retenibles (la ficha no dice el tipo de prima)
    ("Sale Seguro TLMK", "Seguros Generales Sura", "RETENIBLE", "sin_dato", "Sale Seguro TLMK"),
    ("Incendio Hogar", "Seguros Generales Sura", "RETENIBLE", "sin_dato", "Incendio Hogar"),
    # No retenibles (se pueden renunciar, pero no se intenta retener)
    ("LINEA DE CREDITO PROTEGIDA", "BNP Paribas Cardif", "NO_RETENIBLE", "sin_dato", None),
    ("SEGURO DE DESEMPLEO CONSUMO", "BNP Paribas Cardif", "NO_RETENIBLE", "sin_dato", None),
    ("L. DE CREDITO PROTEGIDA MYPE", "BNP Paribas Cardif", "NO_RETENIBLE", "sin_dato", None),
    ("CONSTRUCCION VIDA", "BNP Paribas Cardif", "NO_RETENIBLE", "sin_dato", None),
    ("SEGURO DESGRAVAMEN CED PROT CO", "BNP Paribas Cardif", "NO_RETENIBLE", "sin_dato", None),
    ("SEGURO AUTOMOTRIZ", "Penta Security", "NO_RETENIBLE", "sin_dato", None),
    ("DESGRAVAMEN", "Rigel Seguros de Vida", "NO_RETENIBLE", "sin_dato", None),
    ("INC. SISMO (CONTENIDO)", "Seguros Generales Sura", "NO_RETENIBLE", "sin_dato", None),
    ("SEGURO PROTECCION HOGAR", "Seguros Generales Sura", "NO_RETENIBLE", "sin_dato", None),
    ("EDUCACION ASEGURADA", "MetLife", "NO_RETENIBLE", "sin_dato", None),
    # No renunciables
    ("DESGRAVAMEN NOMINAL", None, "NO_RENUNCIABLE_SUCURSAL", "sin_dato", None),
    ("INCENDIO (EDIFICIO)", None, "NO_RENUNCIABLE_SUCURSAL", "sin_dato", None),
    ("INCENDIO TASA NOMINAL", None, "NO_RENUNCIABLE_SUCURSAL", "sin_dato", None),
    ("DESGRV.INV.UNIV.ESTATAL", None, "NO_RENUNCIABLE_COSTO_BANCO", "sin_dato", None),
    ("DESG UNIV GARANTIA ESTATAL", None, "NO_RENUNCIABLE_COSTO_BANCO", "sin_dato", None),
    ("UNIV GARANTIA ESTATAL", None, "NO_RENUNCIABLE_COSTO_BANCO", "sin_dato", None),
    ("INV UNIV GARANTIA ESTATAL", None, "NO_RENUNCIABLE_COSTO_BANCO", "sin_dato", None),
    ("SEGURO ACCIDENTES SOAP", "Zenit Seguros Generales", "NO_RENUNCIABLE_OBLIGATORIO", "sin_dato", None),
]

# "DESEMP E INCAPACID TEM" sin "(Hipotecario)" aparece en RESUMEN como "No, subsidiado MINVU (obligatorio)".
SUBSIDIZED_NOTE = (
    "Algunos desempleos hipotecarios vienen marcados 'DESEMP E INCAPACID TEM' (subsidiado MINVU): son obligatorios, "
    "no se pueden renunciar; el cliente no paga el seguro o paga solo una parte."
)

# Texto de RESUMEN para cada categoría de no renunciable.
CATEGORY_RULES = {
    "RETENIBLE": "Seguro retenible: si el cliente pide renunciar, el ejecutivo debe intentar retenerlo.",
    "NO_RETENIBLE": "Seguro NO retenible: se puede renunciar, pero no se debe intentar retener.",
    "NO_RENUNCIABLE_SUCURSAL": (
        "No renunciable por teléfono (obligatorio). Solo se puede reemplazar por otra póliza y esa gestión se hace "
        "en sucursal. Se registra como consulta: 'seguro no se puede renunciar, se deriva a sucursal'."
    ),
    "NO_RENUNCIABLE_COSTO_BANCO": "No renunciable: lo paga el banco, no tiene costo para el cliente. No se hace ninguna gestión.",
    "NO_RENUNCIABLE_OBLIGATORIO": (
        "No renunciable ni reemplazable (obligatorio, SOAP). Si el cliente insiste, se le invita a llamar a la compañía."
    ),
}


def sheet_text(wb, name: str) -> str:
    """Todo el texto de la hoja, fila por fila. Las celdas de una fila se separan con ' | '."""
    lines = []
    with wb.get_sheet(name) as sheet:
        for row in sheet.rows():
            cells = []
            for cell in row:
                value = cell.v
                if value is None or (isinstance(value, str) and not value.strip()):
                    continue
                if isinstance(value, float) and value.is_integer():
                    value = int(value)
                text = " ".join(str(value).split())
                if text.upper().startswith("VOLVER A") and "RESUMEN" in text.upper():
                    continue
                cells.append(text)
            if cells:
                lines.append(" | ".join(cells))
    return "\n".join(lines)


def other_cases(wb) -> list[dict]:
    cases: dict[str, list[str]] = {}
    with wb.get_sheet("Otros") as sheet:
        for row in sheet.rows():
            values = {c.c: c.v for c in row if c.v not in (None, "")}
            if 2 in values and 3 in values and values[2] != "Caso":
                cases.setdefault(str(values[2]).strip(), []).append(" ".join(str(values[3]).split()))
    return [{"case": k, "detail": v} for k, v in cases.items()]


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open_workbook(sys.argv[1]) as wb:
        products = []
        for name, insurer, category, premium_type, sheet in PRODUCTS:
            products.append({
                "name": name,
                "insurer": insurer,
                "category": category,
                "category_rule": CATEGORY_RULES[category],
                "premium_type": premium_type,
                "sheet": sheet,
                "product_sheet": sheet_text(wb, sheet) if sheet else None,
            })
        cases = other_cases(wb)
    payment_methods = next(c["detail"] for c in cases if c["case"] == "Medios de pago")[1:]
    catalog = {
        "source": Path(sys.argv[1]).name,
        "products": products,
        "payment_methods": payment_methods,
        "procedures": [c for c in cases if c["case"] != "Medios de pago"],
        "notes": [SUBSIDIZED_NOTE],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with_sheet = sum(1 for p in products if p["product_sheet"])
    print(f"{len(products)} seguros ({with_sheet} con ficha), {len(cases)} procedimientos -> {OUT}")


if __name__ == "__main__":
    main()
