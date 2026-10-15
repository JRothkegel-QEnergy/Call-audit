"""Arma los prompts de la capa 2 para cada llamada sintética, listos para pegar en cualquier IA.

Uso:
    python scripts/prompt_bench/extract_catalog.py "<ruta>/Apoyo_Seguros_estandarizado.xlsx"   # una vez
    python scripts/prompt_bench/render.py

Genera en scripts/prompt_bench/prompts/:
    system.txt          system prompt (igual para todas las llamadas)
    synth_NN.txt        mensaje de usuario de cada llamada
    synth_NN_full.txt   system + usuario en un solo texto, para chats sin campo de system prompt

Cada seguro de los metadatos se completa con la ficha estándar (docs/layer2-product-sheet.md) y los datos de
data/catalog/products.json.
"""

import json
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROMPT_DOC = ROOT / "docs" / "layer2-prompt-example.md"
CALLS_DIR = ROOT / "tests" / "fixtures" / "calls"
CATALOG = ROOT / "data" / "catalog" / "products.json"
OUT_DIR = Path(__file__).resolve().parent / "prompts"

# Nota del cliente al motivo 1: "más de 30 segundos sin hablarle".
HOLD_THRESHOLD_SEC = 30
SHEET_DOC = ROOT / "docs" / "layer2-product-sheet.md"
NO_DATA = "sin dato en el catálogo"
PREMIUM = {
    "credito": (
        "prima única asociada a un crédito (cobro anticipado)",
        "corresponde devolución automática de la prima no devengada, en 10 días hábiles desde que la compañía toma conocimiento.",
    ),
    "anual": (
        "prima anual (cobro anticipado)",
        "corresponde devolución automática de la prima no devengada, en 10 días hábiles desde que la compañía toma conocimiento.",
    ),
    "mensual": (
        "prima mensual",
        "no hay devolución automática; si el cliente la pide por cobros incorrectos o desconocimiento, "
        "se le invita a ingresar un requerimiento al 600 660 1212, opción 2.",
    ),
    "sin_dato": (NO_DATA, NO_DATA),
}
CATEGORY_RULES = {
    "RETENIBLE": "Si el cliente pide renunciar, el ejecutivo debe intentar retenerlo.",
    "NO_RETENIBLE": "Se puede renunciar, pero no se debe intentar retener (motivo 17).",
    "NO_RENUNCIABLE_SUCURSAL": "No se puede renunciar por teléfono; solo se reemplaza por otra póliza en sucursal. Se registra como consulta.",
    "NO_RENUNCIABLE_COSTO_BANCO": "Lo paga el banco, no tiene costo para el cliente. No se hace ninguna gestión.",
    "NO_RENUNCIABLE_SUBSIDIADO": "Subsidiado MINVU, obligatorio. No se puede renunciar; el cliente no paga o paga solo una parte.",
    "NO_RENUNCIABLE_OBLIGATORIO": "Obligatorio (SOAP). No se renuncia ni se reemplaza; si el cliente insiste, que llame a la compañía.",
}
# Beneficios de la compañía, comunes a toda póliza MetLife. El Excel de apoyo no los trae y casi todos los ejecutivos
# los mencionan: sin este bloque la IA marcaba SIN_FICHA. Contenido genérico, sin porcentajes ni teléfonos, hasta que
# el cliente confirme el detalle (docs/client-open-questions.md, n.º 26).
METLIFE_BENEFITS = (
    "Beneficios adicionales MetLife (comunes a todas las pólizas MetLife, no son coberturas del seguro): descuentos "
    "en convenios de salud y centros médicos, dental, ópticas y oftalmología, farmacias, laboratorio e imágenes, "
    "deporte, tiempo libre, belleza, bienestar y gourmet. Se revisan en el portal de beneficios adicionales de "
    "metlife.cl; el cliente se identifica con su RUT y menciona el convenio MetLife. Porcentajes y convenios varían "
    "y no están en esta ficha: no los contrastes."
)

# Las celdas de detalle a veces traen párrafos largos (causales, documentos). Se recortan para no inflar el prompt.
MAX_DETAIL = 900
MAX_DOCUMENTS = 300

JSON_OUTPUT_INSTRUCTION = """
## Formato de respuesta (modo chat, sin herramientas)
Si no tienes disponible la herramienta registrar_auditoria, responde ÚNICAMENTE con un
objeto JSON válido que cumpla este esquema, sin texto antes ni después y sin bloques de código:
{schema}
Evalúa los 33 motivos: incluye un elemento en "criterios" por cada id del 1 al 33.
"""


def read_code_blocks(path: Path) -> list[str]:
    blocks, current, inside = [], [], False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("```"):
            if inside:
                blocks.append("\n".join(current))
                current = []
            inside = not inside
            continue
        if inside:
            current.append(line)
    return blocks


def fmt(ms: int) -> str:
    sec = ms // 1000
    return f"{sec // 60:02d}:{sec % 60:02d}"


def load_catalog() -> dict:
    if not CATALOG.exists():
        sys.exit(f"Falta {CATALOG}. Corre primero: python scripts/prompt_bench/extract_catalog.py \"<ruta>/Apoyo_Seguros_estandarizado.xlsx\"")
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def normalize(name: str) -> str:
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return " ".join(text.upper().split())


def find_product(name: str, catalog: dict) -> dict:
    for product in catalog["products"]:
        if normalize(name) in {normalize(n) for n in product["system_names"]}:
            return product
    sys.exit(f"El seguro '{name}' no está en el catálogo.")


def payment_description(code: str, catalog: dict) -> str:
    if code == "OTRO":
        return "OTRO (otro medio de pago: no se menciona en el cierre)"
    return f"{code} ({catalog['payment_methods'].get(code, 'sin descripción en el catálogo')})"


def short(text: str | None, limit: int) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + " (...)"


def bullet_list(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items) if items else f"- {NO_DATA}"


def join_fields(*pairs: tuple[str, str | None]) -> str:
    parts = [(label, str(value).rstrip(". ")) for label, value in pairs if value]
    return ". ".join(f"{label}: {value}" if label else value for label, value in parts if value)


def contract_lines(policy: dict) -> str:
    """Plan, prima y monto del CONTRATO del cliente (sistema de BancoEstado). Las llamadas sintéticas no los traen:
    queda vacío y la ficha no cambia. Pueden diferir de la ficha general (planes antiguos, stock, migraciones)."""
    fields = [
        ("plan contratado", policy.get("plan")),
        ("prima del cliente", policy.get("premium")),
        ("periodicidad de la prima", policy.get("periodicity")),
        ("monto asegurado del cliente", policy.get("insured_amount")),
    ]
    return "".join(f"\n- {label}: {value}" for label, value in fields if value)


def render_policy(n: int, policy: dict, catalog: dict, templates: tuple[str, str]) -> str:
    product = find_product(policy["name"], catalog)
    premium, refund = PREMIUM[product["premium_type"]]
    values = {
        "n": n,
        "nombre_sistema": policy["name"],
        "mus_a_neto": policy["mus_a_neto"],
        "n_poliza": policy.get("policy_number") or NO_DATA,
        "inicio_vigencia": policy.get("start_date") or NO_DATA,
        "medio_pago": payment_description(policy["payment_method"], catalog),
        "datos_contrato": contract_lines(policy),
        "id_producto": product["id"],
        "nombre_real": product["name"],
        "compania": product.get("insurer") or NO_DATA,
        "categoria": product["category"],
        "regla_categoria": CATEGORY_RULES[product["category"]] + (f" {product['category_detail']}" if product.get("category_detail") else ""),
    }
    if not product["id"]:
        return templates[1].format(**values)

    general = [
        ("capital asegurado", product.get("insured_capital")),
        ("edad mínima de ingreso", product.get("min_entry_age")),
        ("edad máxima de ingreso", product.get("max_entry_age")),
        ("edad máxima de permanencia", product.get("max_stay_age")),
        ("inicio de cobertura", product.get("coverage_start")),
        ("apoyo solidario", product.get("solidarity_support")),
        ("plazo para denunciar siniestros (días)", product.get("claim_deadline_days")),
        ("fono asistencias", product.get("assistance_phone")),
        ("notas", product.get("notes")),
    ]
    coverages = [
        join_fields(("", c["name"]), ("monto", c.get("amount") and short(c["amount"], 300)), ("", short(c.get("detail"), MAX_DETAIL)), ("beneficiario", c.get("beneficiary")))
        for c in product["coverages"]
    ]
    assistances = [
        join_fields(("", a["name"]), ("", short(a.get("detail"), 400)), ("eventos", a.get("events")), ("tope", a.get("cap")), ("fono", a.get("phone")))
        for a in product["assistances"]
    ]
    if "metlife" in (product.get("insurer") or "").lower():
        assistances.append(METLIFE_BENEFITS)
    premiums = [
        join_fields(("", r.get("plan")), ("", r.get("insured")), ("edad", r.get("age_band")), ("monto asegurado", r.get("amount_insured")),
                    ("prima UF", r.get("premium_uf")), ("prima $ aprox.", r.get("premium_clp")), ("", r.get("periodicity")))
        for r in product["premiums"]
    ]
    claims = [
        join_fields(("", c.get("coverage")), ("plazo", c.get("deadline")), ("canal", c.get("channel")), ("documentos", short(c.get("documents"), MAX_DOCUMENTS)))
        for c in product["claims"]
    ]
    disability = [f"días {r['from_day']} a {r['to_day'] or 'más'}: {r['amount']}" for r in product["temporary_disability_table"]]
    values.update({
        "tipo_prima": premium,
        "modalidad_prima": product.get("premium_mode") or NO_DATA,
        "regla_devolucion": refund,
        "retracto": product.get("withdrawal") or NO_DATA,
        "datos_generales": "\n".join(f"- {label}: {value}" for label, value in general if value),
        "coberturas": bullet_list(coverages),
        "asistencias": bullet_list(assistances),
        "primas": bullet_list(premiums),
        "tabla_incapacidad": f"Indemnización por incapacidad temporal:\n{bullet_list(disability)}\n" if disability else "",
        "siniestros": bullet_list(claims),
        "observaciones": ("Observaciones del catálogo (inconsistencias del original):\n" + bullet_list(product["observations"])) if product["observations"] else "",
    })
    return templates[0].format(**values).rstrip()


def render_user_message(call: dict, catalog: dict, templates: tuple[str, str]) -> str:
    meta = call["metadata"]
    policies = "\n\n".join(render_policy(i, p, catalog, templates) for i, p in enumerate(meta["policies"], start=1))
    typification = "\n".join(
        f"- seguro: {t['mus_a_neto']} | gestion: {t['outcome']} | motivo: {t['reason']}" for t in meta["typification"]
    ) or "- (sin tipificación registrada)"
    transcript = "\n".join(
        f"[{fmt(s['start_ms'])}] {'AGENTE' if s['channel'] == 'agent' else 'CLIENTE'}: {s['text']}" for s in call["transcript"]
    )
    return f"""## Metadatos
llamada_id: {call['call_id']}
fecha: {meta['date']}
ejecutivo: {meta['agent_id']}
duracion_seg: {meta['duration_sec']}
esperas_seg: {meta['holds_sec']}
umbral_espera_seg: {HOLD_THRESHOLD_SEC}

## Seguros del cliente consultados en la llamada
{policies}

## Tipificación registrada por el ejecutivo
{typification}

## Transcripción (canal separado, timestamps mm:ss)
{transcript}
"""


def main() -> None:
    catalog = load_catalog()
    sheet_blocks = read_code_blocks(SHEET_DOC)
    templates = (sheet_blocks[0], sheet_blocks[1])
    blocks = read_code_blocks(PROMPT_DOC)
    system_prompt, schema = blocks[0], blocks[3]
    system_prompt += "\n" + JSON_OUTPUT_INSTRUCTION.format(schema=json.dumps(json.loads(schema)["input_schema"], ensure_ascii=False))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("synth_*.txt"):
        old.unlink()
    (OUT_DIR / "system.txt").write_text(system_prompt + "\n", encoding="utf-8")
    for path in sorted(CALLS_DIR.glob("synth_*.json")):
        call = json.loads(path.read_text(encoding="utf-8"))
        user = render_user_message(call, catalog, templates)
        (OUT_DIR / f"{path.stem}.txt").write_text(user, encoding="utf-8")
        (OUT_DIR / f"{path.stem}_full.txt").write_text(f"{system_prompt}\n\n---\n\n{user}", encoding="utf-8")
        print(f"ok {path.stem}")


if __name__ == "__main__":
    main()
