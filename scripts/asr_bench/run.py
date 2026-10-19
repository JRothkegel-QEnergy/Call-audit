"""Benchmark de ASR: transcribe un audio con varios proveedores y guarda cada salida.

Uso:
    python scripts/asr_bench/run.py <audio.mp3> [--out DIR] [--only id1,id2]

Las salidas contienen PII: el directorio por defecto queda FUERA del repo.
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import tomllib
import urllib.request
from pathlib import Path

from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT.parent / "transcripts" / "asr_bench"

# Contexto genérico del dominio (sin datos del cliente puntual).
CONTEXT = (
    "Llamada telefónica de retención de seguros de BancoEstado Corredores de Seguros, Chile. "
    "Un ejecutivo conversa con un cliente que quiere renunciar a su seguro. Español chileno."
)
KEYWORDS = [
    "BancoEstado",
    "BancoEstado Corredores de Seguros",
    "MetLife",
    "CuentaRUT",
    "RUT",
    "póliza",
    "prima",
    "renuncia",
    "accidentes personales",
    "muerte accidental",
    "desgravamen",
    "UF",
]

GEMINI_PROMPT = f"""{CONTEXT}

Transcribe la llamada completa, literal, en español, sin resumir ni corregir el habla.
Separa por turnos de hablante. Identifica a cada hablante como "EJECUTIVO" o "CLIENTE"
(si hay otro, por ejemplo una grabación o IVR, usa "OTRO").
Devuelve SOLO JSON con este formato:
{{"segments": [{{"speaker": "EJECUTIVO", "start": "mm:ss", "end": "mm:ss", "text": "..."}}]}}
"""


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def audio_upload(audio: Path) -> tuple[str, bytes, str]:
    """Los audios del cliente vienen como WAV con extensión .mp3; se envían con el tipo real."""
    data = audio.read_bytes()
    if data[:4] == b"RIFF":
        return (f"{audio.stem}.wav", data, "audio/wav")
    return (audio.name, data, "audio/mpeg")


def to_dict(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if isinstance(obj, str):
        return {"text": obj}
    return obj


# --- Proveedores -----------------------------------------------------------


def openai_client() -> OpenAI:
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def groq_client() -> OpenAI:
    return OpenAI(api_key=os.environ["GROQ_API_KEY"], base_url="https://api.groq.com/openai/v1")


def run_gpt_transcribe(audio: Path) -> dict:
    r = openai_client().audio.transcriptions.create(
            model="gpt-transcribe",
            file=audio_upload(audio),
            prompt=CONTEXT,
            extra_body={"keywords": KEYWORDS, "languages": ["es"]},
        )
    return to_dict(r)


def run_gpt4o_diarize(audio: Path) -> dict:
    r = openai_client().audio.transcriptions.create(
            model="gpt-4o-transcribe-diarize",
            file=audio_upload(audio),
            response_format="diarized_json",
            chunking_strategy="auto",
            language="es",
        )
    return to_dict(r)


def run_gpt4o_mini(audio: Path) -> dict:
    r = openai_client().audio.transcriptions.create(
            model="gpt-4o-mini-transcribe", file=audio_upload(audio), prompt=CONTEXT, language="es"
        )
    return to_dict(r)


def _whisper(client: OpenAI, model: str, audio: Path) -> dict:
    r = client.audio.transcriptions.create(
            model=model,
            file=audio_upload(audio),
            language="es",
            prompt=CONTEXT,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
    return to_dict(r)


def run_whisper1(audio: Path) -> dict:
    return _whisper(openai_client(), "whisper-1", audio)


def run_groq_v3(audio: Path) -> dict:
    return _whisper(groq_client(), "whisper-large-v3", audio)


def run_groq_v3_turbo(audio: Path) -> dict:
    return _whisper(groq_client(), "whisper-large-v3-turbo", audio)


GEMINI_API = "https://generativelanguage.googleapis.com"
# El request inline tiene tope de ~20 MB y el base64 infla ~33 %: sobre esto se usa la Files API.
GEMINI_INLINE_MAX_BYTES = 14_000_000


def _gemini_upload(data: bytes, mime: str, name: str) -> str:
    """Sube el audio con la Files API (upload resumable) y devuelve su file_uri."""
    key = os.environ["GEMINI_API_KEY"]
    start = urllib.request.Request(
        f"{GEMINI_API}/upload/v1beta/files",
        data=json.dumps({"file": {"display_name": name}}).encode(),
        headers={
            "x-goog-api-key": key,
            "Content-Type": "application/json",
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": str(len(data)),
            "X-Goog-Upload-Header-Content-Type": mime,
        },
    )
    with urllib.request.urlopen(start, timeout=120) as resp:
        upload_url = resp.headers["X-Goog-Upload-URL"]
    finish = urllib.request.Request(
        upload_url,
        data=data,
        headers={"X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize"},
    )
    with urllib.request.urlopen(finish, timeout=600) as resp:
        info = json.load(resp)["file"]
    # Los audios suelen quedar ACTIVE al tiro; si no, se espera.
    while info.get("state") == "PROCESSING":
        time.sleep(2)
        req = urllib.request.Request(f"{GEMINI_API}/v1beta/{info['name']}", headers={"x-goog-api-key": key})
        with urllib.request.urlopen(req, timeout=60) as resp:
            info = json.load(resp)
    return info["uri"]


def _gemini(model: str, audio: Path) -> dict:
    name, data, mime = audio_upload(audio)
    if len(data) > GEMINI_INLINE_MAX_BYTES:
        audio_part = {"file_data": {"mime_type": mime, "file_uri": _gemini_upload(data, mime, audio.stem)}}
    else:
        audio_part = {"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}}
    body = {
        "contents": [{"parts": [audio_part, {"text": GEMINI_PROMPT}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
    }
    req = urllib.request.Request(
        f"{GEMINI_API}/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]},
    )
    with urllib.request.urlopen(req, timeout=900) as resp:
        raw = json.load(resp)
    text = "".join(p.get("text", "") for p in raw["candidates"][0]["content"]["parts"])
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = {"text": text}
    parsed["usage"] = raw.get("usageMetadata")
    return parsed


def _openrouter_audio(model: str, audio: Path) -> dict:
    name, data, mime = audio_upload(audio)
    client = OpenAI(api_key=os.environ["OPENROUTER_API_KEY"], base_url="https://openrouter.ai/api/v1")
    r = client.chat.completions.create(
        model=model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": GEMINI_PROMPT},
                    {
                        "type": "input_audio",
                        "input_audio": {"data": base64.b64encode(data).decode(), "format": name.rsplit(".", 1)[-1]},
                    },
                ],
            }
        ],
    )
    text = r.choices[0].message.content or ""
    text = text.strip().removeprefix("```json").removesuffix("```").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = {"text": text}
    parsed["usage"] = to_dict(r.usage)
    return parsed


def run_gemini_flash(audio: Path) -> dict:
    return _gemini("gemini-3.8-flash", audio)


def run_gemini_pro(audio: Path) -> dict:
    return _gemini("gemini-3.1-pro-preview", audio)


PROVIDERS = {
    "openai_gpt-transcribe": run_gpt_transcribe,
    "openai_gpt-4o-transcribe-diarize": run_gpt4o_diarize,
    "openai_gpt-4o-mini-transcribe": run_gpt4o_mini,
    "openai_whisper-1": run_whisper1,
    "groq_whisper-large-v3": run_groq_v3,
    "groq_whisper-large-v3-turbo": run_groq_v3_turbo,
    "gemini_3.8-flash": run_gemini_flash,
    "gemini_3.1-pro-preview": run_gemini_pro,
    "openrouter_gemini-3.8-flash": lambda a: _openrouter_audio("google/gemini-3.8-flash", a),
    "openrouter_gemini-3.1-pro": lambda a: _openrouter_audio("google/gemini-3.1-pro-preview", a),
}

# Por defecto solo los que separan ejecutivo/cliente y entregan timestamps.
# Los demás quedan disponibles con --only.
DEFAULT_PROVIDERS = [
    "gemini_3.8-flash",
    "openrouter_gemini-3.8-flash",
    "openrouter_gemini-3.1-pro",
    "openai_gpt-4o-transcribe-diarize",
]


# --- Costos -------------------------------------------------------------------

PRICING = tomllib.loads((Path(__file__).parent / "pricing.toml").read_text(encoding="utf-8"))


def audio_seconds(audio: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(audio)],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(out.stdout.strip())


def estimate_cost(provider: str, result: dict, seconds: float) -> float | None:
    price = PRICING.get(provider)
    if not price or not result:
        return None
    usage = result.get("usage") or {}
    basis = price["basis"]
    if basis == "per_minute":
        return seconds / 60 * price["usd"]
    if basis == "per_hour":
        return max(seconds, price.get("min_seconds", 0)) / 3600 * price["usd"]
    if basis == "tokens":
        details = usage.get("input_token_details") or {}
        audio_in = details.get("audio_tokens", 0)
        text_in = details.get("text_tokens", usage.get("input_tokens", 0) - audio_in)
        return (
            audio_in * price["audio_in_per_m"]
            + text_in * price["text_in_per_m"]
            + usage.get("output_tokens", 0) * price["out_per_m"]
        ) / 1e6
    if basis == "reported":
        return usage.get("cost")
    return None


# --- Render legible -----------------------------------------------------------


def fmt_ts(value) -> str:
    if isinstance(value, (int, float)):
        return f"{int(value // 60):02d}:{int(value % 60):02d}"
    return str(value or "")


def render_text(result: dict) -> str:
    segments = result.get("segments")
    if segments:
        lines = []
        for s in segments:
            speaker = s.get("speaker") or ""
            prefix = f"[{fmt_ts(s.get('start'))}]" + (f" {speaker}:" if speaker else "")
            lines.append(f"{prefix} {str(s.get('text', '')).strip()}")
        return "\n".join(lines)
    return result.get("text", "")


def run_providers(audio: Path, providers: list[str], out_dir: Path, log=print) -> list[dict]:
    """Corre cada proveedor sobre el audio, guarda .json/.txt y actualiza _summary.json."""
    out_dir.mkdir(parents=True, exist_ok=True)
    seconds = audio_seconds(audio)
    summary = []
    for name in providers:
        t0 = time.perf_counter()
        try:
            result = PROVIDERS[name](audio)
            error = None
        except Exception as exc:  # noqa: BLE001 - queremos seguir con los demás
            result, error = {}, f"{type(exc).__name__}: {exc}"
        elapsed = round(time.perf_counter() - t0, 1)
        if error:
            log(f"[{audio.stem}] {name}: ERROR ({elapsed}s): {error}")
        else:
            (out_dir / f"{name}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            (out_dir / f"{name}.txt").write_text(render_text(result), encoding="utf-8")
            log(f"[{audio.stem}] {name}: ok ({elapsed}s)")
        summary.append(
            {
                "provider": name,
                "seconds": elapsed,
                "audio_seconds": seconds,
                "cost_usd": estimate_cost(name, result, seconds),
                "error": error,
                "usage": result.get("usage"),
            }
        )

    # Combina con corridas anteriores para no perder los tiempos de otros proveedores.
    summary_path = out_dir / "_summary.json"
    if summary_path.exists():
        done = {s["provider"] for s in summary}
        summary = [s for s in json.loads(summary_path.read_text(encoding="utf-8")) if s["provider"] not in done] + summary
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--only", default="")
    parser.add_argument("--recost", action="store_true", help="Recalcula costos de salidas existentes sin llamar APIs")
    args = parser.parse_args()

    load_env(REPO_ROOT / ".env")
    selected = [p for p in args.only.split(",") if p] or DEFAULT_PROVIDERS
    out_dir = args.out / args.audio.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    seconds = audio_seconds(args.audio)

    if args.recost:
        summary_path = out_dir / "_summary.json"
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        for item in summary:
            path = out_dir / f"{item['provider']}.json"
            item["audio_seconds"] = seconds
            if path.exists():
                item["cost_usd"] = estimate_cost(item["provider"], json.loads(path.read_text(encoding="utf-8")), seconds)
                print(f"{item['provider']}: {item['cost_usd']}")
        summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        return

    run_providers(args.audio, selected, out_dir)
    print(f"\nSalidas en: {out_dir}")


if __name__ == "__main__":
    sys.exit(main())
