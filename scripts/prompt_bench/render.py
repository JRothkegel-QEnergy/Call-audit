"""Arma los prompts de la capa 2 para cada llamada sintética, listos para pegar en cualquier IA.

Uso:
    python scripts/prompt_bench/render.py

Genera en scripts/prompt_bench/prompts/:
    system.txt          system prompt (igual para todas las llamadas)
    synth_NN.txt        mensaje de usuario de cada llamada
    synth_NN_full.txt   system + usuario en un solo texto, para chats sin campo de system prompt
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROMPT_DOC = ROOT / "docs" / "layer2-prompt-example.md"
CALLS_DIR = ROOT / "tests" / "fixtures" / "calls"
OUT_DIR = Path(__file__).resolve().parent / "prompts"

# Umbral de ejemplo: el real es TBD con el cliente (docs/client-open-questions.md).
EXAMPLE_HOLD_THRESHOLD_SEC = 120
MISSING_PRODUCT_SHEET = "No disponible (ficha pendiente con el cliente). Evalúa los motivos 2 y 6 como 'indeterminado' si dependen de la ficha."

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


def render_user_message(call: dict, desempleo_sheet: str) -> str:
    meta = call["metadata"]
    yes_no = lambda b: "si" if b else "no"  # noqa: E731
    policies = "\n".join(
        f"- nombre: {p['name']} | n_poliza: {p['policy_number']} | retenible: {yes_no(p['retainable'])} "
        f"| renunciable_en_canal: {yes_no(p['cancellable_in_channel'])}"
        for p in meta["policies"]
    )
    typification = "\n".join(
        f"- seguro: {t['policy_number']} | gestion: {t['outcome']} | motivo: {t['reason']}"
        for t in meta["typification"]
    ) or "- (sin tipificación registrada)"
    sheets = [desempleo_sheet if "Desempleo" in p["name"] else f"{p['name']}: {MISSING_PRODUCT_SHEET}" for p in meta["policies"]]
    transcript = "\n".join(
        f"[{fmt(s['start_ms'])}] {'AGENTE' if s['channel'] == 'agent' else 'CLIENTE'}: {s['text']}"
        for s in call["transcript"]
    )
    return f"""## Metadatos
llamada_id: {call['call_id']}
fecha: {meta['date']}
ejecutivo: {meta['agent_id']}
duracion_seg: {meta['duration_sec']}
esperas_seg: {meta['holds_sec']}
umbral_espera_seg: {EXAMPLE_HOLD_THRESHOLD_SEC}

## Seguros del cliente consultados en la llamada
{policies}

## Tipificación registrada por el ejecutivo
{typification}

## Ficha de producto (del seguro gestionado)
{chr(10).join(dict.fromkeys(sheets))}

## Transcripción (canal separado, timestamps mm:ss)
{transcript}
"""


def main() -> None:
    blocks = read_code_blocks(PROMPT_DOC)
    system_prompt, _user_template, desempleo_sheet, schema = blocks[0], blocks[1], blocks[2], blocks[3]
    system_prompt += "\n" + JSON_OUTPUT_INSTRUCTION.format(schema=json.dumps(json.loads(schema)["input_schema"], ensure_ascii=False))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "system.txt").write_text(system_prompt + "\n", encoding="utf-8")
    for path in sorted(CALLS_DIR.glob("synth_*.json")):
        call = json.loads(path.read_text(encoding="utf-8"))
        user = render_user_message(call, desempleo_sheet)
        (OUT_DIR / f"{path.stem}.txt").write_text(user, encoding="utf-8")
        (OUT_DIR / f"{path.stem}_full.txt").write_text(f"{system_prompt}\n\n---\n\n{user}", encoding="utf-8")
        print(f"ok {path.stem}")


if __name__ == "__main__":
    main()
