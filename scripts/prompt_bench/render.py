"""Arma los prompts de la capa 2 para cada llamada sintética, listos para pegar en cualquier IA.

Uso:
    python scripts/prompt_bench/extract_catalog.py "<ruta>/Apoyo nuevo v1.xlsb"   # una vez
    python scripts/prompt_bench/render.py

Genera en scripts/prompt_bench/prompts/:
    system.txt          system prompt (igual para todas las llamadas)
    synth_NN.txt        mensaje de usuario de cada llamada
    synth_NN_full.txt   system + usuario en un solo texto, para chats sin campo de system prompt

Los datos de cada seguro (categoría, tipo de prima, ficha) salen de data/catalog/products.json.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROMPT_DOC = ROOT / "docs" / "layer2-prompt-example.md"
CALLS_DIR = ROOT / "tests" / "fixtures" / "calls"
CATALOG = ROOT / "data" / "catalog" / "products.json"
OUT_DIR = Path(__file__).resolve().parent / "prompts"

# Nota del cliente al motivo 1: "más de 30 segundos sin hablarle".
HOLD_THRESHOLD_SEC = 30
MISSING_PRODUCT_SHEET = "No disponible: el Excel de apoyo no tiene ficha para este seguro."
PREMIUM = {
    "credito": (
        "prima única asociada a un crédito",
        "al renunciar, la devolución de la prima no devengada es automática.",
    ),
    "anual": ("prima anual", "tiene devolución de la prima no devengada."),
    "mensual": (
        "prima mensual",
        "no hay devolución automática; si el cliente la pide por cobros incorrectos o desconocimiento, "
        "se le invita a ingresar un requerimiento al 600 660 1212, opción 2.",
    ),
    "sin_dato": ("sin dato en el catálogo", "sin dato."),
}

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
        sys.exit(f"Falta {CATALOG}. Corre primero: python scripts/prompt_bench/extract_catalog.py \"<ruta>/Apoyo nuevo v1.xlsb\"")
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def payment_description(code: str, catalog: dict) -> str:
    if code == "OTRO":
        return "otro medio de pago"
    for line in catalog["payment_methods"]:
        if line.split(":", 1)[0].strip() == code:
            return line.split(":", 1)[1].strip()
    return "sin descripción en el catálogo"


def render_policy(n: int, policy: dict, catalog: dict) -> str:
    products = {p["name"]: p for p in catalog["products"]}
    product = products.get(policy["name"])
    if product is None:
        sys.exit(f"El seguro '{policy['name']}' no está en el catálogo.")
    premium, refund = PREMIUM[product["premium_type"]]
    code = policy["payment_method"]
    return f"""### Seguro {n}: {product['name']}
- N° de seguro (MUS A Neto): {policy['mus_a_neto']}
- N° de póliza: {policy.get('policy_number') or 'sin dato'}
- inicio de vigencia: {policy.get('start_date') or 'sin dato'}
- compañía: {product['insurer'] or 'sin dato'}
- categoría: {product['category']}. {product['category_rule']}
- tipo de prima: {premium}. Devolución: {refund}
- medio de pago: {code} ({payment_description(code, catalog)})
- ficha del producto:
{product['product_sheet'] or MISSING_PRODUCT_SHEET}"""


def render_user_message(call: dict, catalog: dict) -> str:
    meta = call["metadata"]
    policies = "\n\n".join(render_policy(i, p, catalog) for i, p in enumerate(meta["policies"], start=1))
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
    blocks = read_code_blocks(PROMPT_DOC)
    system_prompt, schema = blocks[0], blocks[3]
    system_prompt += "\n" + JSON_OUTPUT_INSTRUCTION.format(schema=json.dumps(json.loads(schema)["input_schema"], ensure_ascii=False))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("synth_*.txt"):
        old.unlink()
    (OUT_DIR / "system.txt").write_text(system_prompt + "\n", encoding="utf-8")
    for path in sorted(CALLS_DIR.glob("synth_*.json")):
        call = json.loads(path.read_text(encoding="utf-8"))
        user = render_user_message(call, catalog)
        (OUT_DIR / f"{path.stem}.txt").write_text(user, encoding="utf-8")
        (OUT_DIR / f"{path.stem}_full.txt").write_text(f"{system_prompt}\n\n---\n\n{user}", encoding="utf-8")
        print(f"ok {path.stem}")


if __name__ == "__main__":
    main()
