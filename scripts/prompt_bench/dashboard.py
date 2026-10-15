"""Dashboard local para revisar la validación de capa 2 sobre llamadas reales, una por una y en conjunto.

Uso:
    python scripts/prompt_bench/dashboard.py --out <carpeta de real_calls.py> --metadata XLSX --audios DIR
        [--compare "v2.4=<carpeta de resultados anterior>"] [--label v2.6]

Escribe <out>/dashboard.html. Referencia los audios por ruta relativa: ábrelo con el servidor local
(python -m http.server desde "Qubico Develop") para poder escuchar y saltar a cualquier punto.
Contiene datos reales: no se publica ni se commitea.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import real_calls  # noqa: E402
import run as bench  # noqa: E402
from viewer import CRITERIA  # noqa: E402

LABELS = {
    "gemini-3-8-flash": "Gemini 3.8 Flash",
    "gpt-6-luna": "GPT-6 Luna",
    "claude-sonnet-5-5": "Sonnet 5.5",
    "claude-haiku-5-5": "Haiku 5.5",
    "or-gemini-3-8-flash": "Gemini 3.8 Flash (OR)",
    "or-deepseek-v4-1-flash": "DeepSeek V4.1 Flash",
}
# Color fijo por modelo (la identidad no cambia si se filtra).
ORDER = ["gemini-3-8-flash", "gpt-6-luna", "claude-sonnet-5-5", "claude-haiku-5-5", "or-gemini-3-8-flash", "or-deepseek-v4-1-flash"]


def read_result(results: Path, model: str, stem: str, row: dict, full: bool, options: dict) -> dict:
    out = results / model / f"{stem}.json"
    meta_path = results / model / f"{stem}.meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    item = {"cost": meta.get("cost_usd"), "latency": meta.get("latency_ms")}
    if not out.exists():
        err = results / model / f"{stem}.error.txt"
        item["verdict"] = "ERROR" if err.exists() else None
        return item
    try:
        audit = bench.extract_audit(out.read_text(encoding="utf-8"))
    except ValueError as exc:
        item.update(verdict="ERROR", error=str(exc))
        return item
    v, bad, unsure = real_calls.verdict(audit, real_calls.unevaluable_for(row), **options)
    info = audit.get("informacion_seguro") or {}
    item.update(verdict=v, bad=bad, unsure=unsure, info=info.get("estado"))
    if full:
        item["audit"] = {
            "resumen": audit.get("resumen"),
            "informacion_seguro": info,
            "gestiones": audit.get("gestiones"),
            "criterios": audit.get("criterios"),
        }
    return item


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--audios", type=Path, required=True)
    parser.add_argument("--label", default="actual")
    parser.add_argument("--compare", action="append", default=[], help='"etiqueta=carpeta_resultados"')
    parser.add_argument("--verdict", choices=["severity", "v2.6"], default="severity")
    args = parser.parse_args()

    rows = real_calls.load_rows(args.metadata)
    results = args.out / "results"
    models = sorted((d.name for d in results.iterdir() if d.is_dir()), key=lambda m: ORDER.index(m) if m in ORDER else 99)
    versions = [(args.label, results, True)] + [
        (label, Path(path), False) for label, path in (c.split("=", 1) for c in args.compare)
    ]

    calls = []
    for path in sorted((args.out / "calls").glob("call_*.json")):
        call = json.loads(path.read_text(encoding="utf-8"))
        recording = call["audio_href"].split("/")[-2]
        row = rows[recording]
        ficha = re.search(r"ficha: (\S+)", call["description"])
        entry = {
            "stem": path.stem,
            "id": call["call_id"],
            "recording": recording,
            "audio": Path(os.path.relpath((args.audios / f"{recording}.mp3").resolve(), args.out.resolve())).as_posix(),
            "asr_viewer": f"../asr_bench/{recording}/viewer.html",
            "date": call["metadata"]["date"],
            "minutes": round(call["metadata"]["duration_sec"] / 60, 1),
            "agent": real_calls.clean(row.get("EJECUTIVO")),
            "real": real_calls.clean(row["ESTADO_CALIDAD"]).upper(),
            "reason": real_calls.clean(row["MOTIVO RENUNCIA"]),
            "comment": real_calls.clean(row.get("COMENTARIO")),
            "insurance": real_calls.clean(row["NOMBRE_DEL_SEGURO"]),
            "plan": real_calls.clean(row.get("PLAN")),
            "ficha": ficha.group(1) if ficha else None,
            "typification": real_calls.clean(row.get("TIPIFICACION")),
            "holds": call["metadata"]["holds_sec"],
            "transcript": [[t["start_ms"] // 1000, t["channel"], t["text"]] for t in call["transcript"]],
            "results": {},
        }
        options = {} if args.verdict == "v2.6" else {"holds": call["metadata"]["holds_sec"], "minor": real_calls.MINOR_CRITERIA}
        for label, res_dir, full in versions:
            entry["results"][label] = {
                m: read_result(res_dir, m, path.stem, row, full, options) for m in models if (res_dir / m).exists()
            }
        calls.append(entry)

    data = {
        "versions": [v[0] for v in versions],
        "models": models,
        "labels": {m: LABELS.get(m, m) for m in models},
        "criteria": CRITERIA,
        "calls": calls,
        "monthly_calls": real_calls.MONTHLY_CALLS,
    }
    template = (Path(__file__).parent / "dashboard_template.html").read_text(encoding="utf-8")
    page = template.replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
    out = args.out / "dashboard.html"
    out.write_text(page, encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
