"""Genera un visor HTML local para comparar las transcripciones de un audio.

Uso:
    python scripts/asr_bench/viewer.py <carpeta_de_salida_del_bench> <audio> [--metadata XLSX]

El HTML queda dentro de la carpeta de salida (fuera del repo) y referencia el audio por
ruta relativa: contiene PII, no se publica ni se commitea.
"""

import argparse
import json
import os
import re
from pathlib import Path

# Mismo orden y set por defecto que run.DEFAULT_PROVIDERS (no se importa para no exigir openai acá).
DEFAULT_PROVIDERS = ["gemini_3.8-flash", "openrouter_gemini-3.8-flash", "openrouter_gemini-3.1-pro", "openai_gpt-4o-transcribe-diarize"]

LABELS = {
    "openai_gpt-transcribe": "OpenAI · gpt-transcribe",
    "openai_gpt-4o-transcribe-diarize": "OpenAI · gpt-4o-transcribe-diarize",
    "openai_gpt-4o-mini-transcribe": "OpenAI · gpt-4o-mini-transcribe",
    "openai_whisper-1": "OpenAI · whisper-1",
    "groq_whisper-large-v3": "Groq · whisper-large-v3",
    "groq_whisper-large-v3-turbo": "Groq · whisper-large-v3-turbo",
    "gemini_3.8-flash": "Gemini 3.8 Flash",
    "gemini_3.1-pro-preview": "Gemini 3.1 Pro",
    "openrouter_gemini-3.8-flash": "Gemini 3.8 Flash (OpenRouter)",
    "openrouter_gemini-3.1-pro": "Gemini 3.1 Pro (OpenRouter)",
}

# Volumen de referencia del cliente (docs/context.md), para proyectar el costo mensual.
MONTHLY_MINUTES = 400_000

METADATA_FIELDS = [
    "EJECUTIVO",
    "FLUJO",
    "MOTIVO RENUNCIA",
    "ESTADO_CALIDAD",
    "NOMBRE_DEL_SEGURO",
    "PRIMA_SEGURO",
    "MONTO_ASEGURADO",
    "NUM_POLIZA",
    "NUM_MUS_ANETO",
    "PERIODO",
]


def parse_ts(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and re.fullmatch(r"\d+:\d{1,2}(:\d{1,2})?(\.\d+)?", value.strip()):
        secs = 0.0
        for part in value.strip().split(":"):
            secs = secs * 60 + float(part)
        return secs
    return None


def normalize(result: dict) -> dict:
    segments = []
    for s in result.get("segments") or []:
        text = str(s.get("text", "")).strip()
        if text:
            segments.append({"start": parse_ts(s.get("start")), "speaker": s.get("speaker") or "", "text": text})
    if not segments and result.get("text"):
        segments = [{"start": None, "speaker": "", "text": result["text"].strip()}]
    return {"segments": segments, "words": sum(len(s["text"].split()) for s in segments)}


def load_metadata(xlsx: Path, recording: str) -> dict:
    import openpyxl

    rows = openpyxl.load_workbook(xlsx, read_only=True).active.iter_rows(values_only=True)
    header = next(rows)
    for row in rows:
        if row[0] == recording:
            data = dict(zip(header, row))
            return {k: str(data.get(k, "")).strip() for k in METADATA_FIELDS if data.get(k) is not None}
    return {}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("bench_dir", type=Path)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--all", action="store_true", help="Incluye también modelos sin hablantes ni timestamps")
    args = parser.parse_args()
    allowed = None if args.all else set(DEFAULT_PROVIDERS)

    summary_path = args.bench_dir / "_summary.json"
    summary = {}
    if summary_path.exists():
        summary = {x["provider"]: x for x in json.loads(summary_path.read_text(encoding="utf-8"))}

    models = []
    order = {p: i for i, p in enumerate(DEFAULT_PROVIDERS)}
    for path in sorted(args.bench_dir.glob("*.json"), key=lambda p: (order.get(p.stem, 99), p.stem)):
        if path.name.startswith("_") or (allowed and path.stem not in allowed):
            continue
        norm = normalize(json.loads(path.read_text(encoding="utf-8")))
        models.append(
            {
                "id": path.stem,
                "label": LABELS.get(path.stem, path.stem),
                "seconds": summary.get(path.stem, {}).get("seconds"),
                "cost": summary.get(path.stem, {}).get("cost_usd"),
                **norm,
            }
        )

    data = {
        "recording": args.audio.stem,
        "audio_seconds": next((x.get("audio_seconds") for x in summary.values() if x.get("audio_seconds")), None),
        "monthly_minutes": MONTHLY_MINUTES,
        "audio": Path(os.path.relpath(args.audio.resolve(), args.bench_dir.resolve())).as_posix(),
        "metadata": load_metadata(args.metadata, args.audio.stem) if args.metadata else {},
        "models": models,
    }
    template = (Path(__file__).parent / "viewer_template.html").read_text(encoding="utf-8")
    html = template.replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
    out = args.bench_dir / "viewer.html"
    out.write_text(html, encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
