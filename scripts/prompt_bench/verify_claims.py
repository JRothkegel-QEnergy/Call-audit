"""Paso aparte de la capa 2: verifica lo que el ejecutivo afirma sobre el seguro contra la ficha y el contrato, y con
eso decide los motivos 2 y 6 (prompt en docs/layer2-claims-prompt.md).

Uso:
    python scripts/prompt_bench/verify_claims.py --out <carpeta de real_calls.py> [--models a,b] [--workers 12]
        [--subdir claims_v1] [--force]

Reutiliza los mensajes de usuario ya renderizados (<out>/prompts/call_*.txt: ficha, contrato y transcripción) y
guarda las respuestas en <out>/<subdir>/<modelo>/. real_calls.py --claims <subdir> las usa para el veredicto.
"""

import argparse
import json
import re
import sys
import tomllib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render  # noqa: E402
import run as bench  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CLAIMS_DOC = ROOT / "docs" / "layer2-claims-prompt.md"
DEFAULT_SUBDIR = "claims_v1"

JSON_INSTRUCTION = """
## Formato de respuesta
Responde ÚNICAMENTE con un objeto JSON válido que cumpla este esquema, sin texto antes ni después y sin bloques de
código:
{schema}
"""


def system_prompt() -> str:
    blocks = render.read_code_blocks(CLAIMS_DOC)
    schema = json.dumps(json.loads(blocks[1]), ensure_ascii=False)
    return blocks[0] + "\n" + JSON_INSTRUCTION.format(schema=schema)


def extract_claims(text: str) -> dict:
    """Primer objeto JSON de la respuesta que trae la lista "afirmaciones"."""
    text = re.sub(r"```(?:json)?", "", text)
    decoder, pos = json.JSONDecoder(), text.find("{")
    while pos != -1:
        try:
            obj, end = decoder.raw_decode(text, pos)
        except json.JSONDecodeError:
            pos = text.find("{", pos + 1)
            continue
        if isinstance(obj, dict) and isinstance(obj.get("afirmaciones"), list):
            return obj
        pos = text.find("{", end)
    raise ValueError("la respuesta no trae 'afirmaciones'")


def _simplify(text: str) -> str:
    import unicodedata

    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z0-9\[\]_ ]", " ", plain).split())


def quote_found(quote: str, transcript: str) -> bool:
    """Cita textual, normalizada. Las respuestas largas se buscan por su primer tramo (los modelos recortan)."""
    q = _simplify(quote)
    if not q:
        return False
    hay = _simplify(transcript)
    return q in hay or " ".join(q.split()[:8]) in hay


def decide(claims: dict, transcript: str) -> tuple[dict[int, str], dict]:
    """Estados de los motivos 2 y 6 a partir de la verificación. Solo cuentan hallazgos con cita encontrada."""
    wrong = [
        a for a in claims.get("afirmaciones", [])
        if a.get("verificacion") == "INCORRECTA" and a.get("material") and not a.get("autocorregida")
    ]
    found = [a for a in wrong if quote_found(a.get("cita", ""), transcript)]
    unanswered = [q for q in claims.get("preguntas_sin_respuesta", []) if quote_found(q.get("cita_pregunta", ""), transcript)]
    m2 = [a for a in found if a.get("origen") == "INICIATIVA"]
    m6 = [a for a in found if a.get("origen") == "RESPUESTA"]
    states = {2: "incumple" if m2 else "cumple", 6: "incumple" if m6 or unanswered else "cumple"}
    detail = {"m2": m2, "m6": m6, "unanswered": unanswered, "quotes_not_found": len(wrong) - len(found)}
    return states, detail


def overrides_for(out: Path, subdir: str, model: str, stem: str) -> dict[int, str] | None:
    """Estados de 2 y 6 para real_calls.verdict, o None si el verificador no tiene respuesta válida (se usa el LLM)."""
    path = out / subdir / model / f"{stem}.json"
    if not path.exists():
        return None
    try:
        claims = extract_claims(path.read_text(encoding="utf-8"))
    except ValueError:
        return None
    user = (out / "prompts" / f"{stem}.txt").read_text(encoding="utf-8")
    transcript = user.split("## Transcripción", 1)[1]
    return decide(claims, transcript)[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--models", default="gemini-3-8-flash,gpt-6-luna")
    parser.add_argument("--subdir", default=DEFAULT_SUBDIR)
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    bench.load_dotenv(ROOT / ".env")
    bench.PROMPTS_DIR = args.out / "prompts"
    bench.RESULTS_DIR = args.out / args.subdir
    system = system_prompt()
    (args.out / args.subdir).mkdir(parents=True, exist_ok=True)
    (args.out / args.subdir / "system.txt").write_text(system + "\n", encoding="utf-8")
    configs = {c["name"]: c for c in tomllib.loads(bench.CONFIG.read_text(encoding="utf-8"))["models"]}
    stems = [c["stem"] for c in json.loads((args.out / "calls.json").read_text(encoding="utf-8"))]
    tasks = [(configs[m], s) for m in args.models.split(",") if m for s in stems]

    def job(task):
        cfg, stem = task
        print(f"   {cfg['name']} {stem}: {bench.run_one(cfg, stem, system, args.force)}", flush=True)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(job, tasks))


if __name__ == "__main__":
    main()
