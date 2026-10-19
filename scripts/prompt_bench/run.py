"""Corre el prompt de la capa 2 sobre las llamadas sintéticas con cada modelo de models.toml.

Uso:
    python scripts/prompt_bench/run.py                      # todos los modelos habilitados
    python scripts/prompt_bench/run.py --models claude-haiku-5-5 --calls synth_01,synth_02
    python scripts/prompt_bench/run.py --force              # repite aunque ya exista el resultado
    python scripts/prompt_bench/run.py --list-models gemini # lista los IDs de modelo de un proveedor

Lee las API keys desde .env (raíz del repo). Por cada llamada guarda en results/<nombre>/:
    synth_NN.json        respuesta de la IA, tal cual
    synth_NN.meta.json   versión del prompt, modelo devuelto por la API, tokens, costo, latencia, fecha
    synth_NN.error.txt   si falló
Todas las IA reciben exactamente el mismo texto (prompts/system.txt + prompts/synth_NN.txt).
"""

import argparse
import json
import os
import sys
import time
import tomllib
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BENCH_DIR = Path(__file__).resolve().parent
PROMPTS_DIR = BENCH_DIR / "prompts"
RESULTS_DIR = BENCH_DIR / "results"
CONFIG = BENCH_DIR / "models.toml"

# Proveedores con API compatible con OpenAI. La key se lee de la variable indicada en .env.
OPENAI_COMPATIBLE = {
    "openai": {"env": "OPENAI_API_KEY", "base_url": None},
    "gemini": {"env": "GEMINI_API_KEY", "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/"},
    "groq": {"env": "GROQ_API_KEY", "base_url": "https://api.groq.com/openai/v1"},
    "openrouter": {"env": "OPENROUTER_API_KEY", "base_url": "https://openrouter.ai/api/v1"},
    "ollama": {"env": None, "base_url": "http://localhost:11434/v1"},
}

# Multiplicadores de prompt caching de Anthropic sobre el precio de input.
CACHE_WRITE_MULT = 1.25
CACHE_READ_MULT = 0.10


def _from_simulated_tool_call(text: str) -> dict | None:
    """Sonnet 5.5 a veces escribe la llamada a la herramienta como texto (<invoke ...><parameter name="x">...),
    pese a la regla 12 del prompt: se arma el objeto desde los <parameter>, parseando como JSON los que lo son."""
    import re

    params = re.findall(r'<parameter name="([^"]+)">(.*?)</parameter>', text, re.S)
    if not params:
        return None
    obj = {}
    for name, value in params:
        try:
            obj[name] = json.loads(value)
        except json.JSONDecodeError:
            obj[name] = value.strip()
    return obj


def extract_audit(text: str) -> dict:
    """Saca la auditoría de la respuesta de una IA. Tolera bloques ```json, texto alrededor, modelos que
    repiten el esquema antes de responder, escapes inválidos (\\$) y la llamada a la herramienta escrita como texto:
    devuelve el primer objeto que trae "criterios" como lista."""
    import re

    simulated = _from_simulated_tool_call(text)
    if simulated and isinstance(simulated.get("criterios"), list):
        return simulated
    text = re.sub(r"```(?:json)?", "", text)
    # Escapes que JSON no admite (Haiku escribe "\$17.237"): se deja el carácter sin la barra.
    text = re.sub(r'\\([^"\\/bfnrtu])', r"\1", text)
    decoder = json.JSONDecoder()
    candidates, pos = [], text.find("{")
    while pos != -1:
        try:
            obj, end = decoder.raw_decode(text, pos)
        except json.JSONDecodeError:
            pos = text.find("{", pos + 1)
            continue
        if isinstance(obj, dict):
            candidates.append(obj.get("input", obj))
        pos = text.find("{", end)
    for obj in candidates:
        if isinstance(obj.get("criterios"), list):
            return obj
    raise ValueError("la respuesta no trae una auditoría con 'criterios' (¿devolvió el esquema?)")


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def api_key_for(provider: str) -> str | None:
    env = "ANTHROPIC_API_KEY" if provider == "anthropic" else OPENAI_COMPATIBLE[provider]["env"]
    return os.environ.get(env) or None if env else "ollama"


def cost_usd(cfg: dict, usage: dict) -> float | None:
    price_in, price_out = cfg.get("price_input_per_mtok"), cfg.get("price_output_per_mtok")
    if price_in is None or price_out is None:
        return None
    input_cost = (
        usage["input_tokens"]
        + usage.get("cache_write_tokens", 0) * CACHE_WRITE_MULT
        + usage.get("cache_read_tokens", 0) * CACHE_READ_MULT
    ) * price_in
    return round((input_cost + usage["output_tokens"] * price_out) / 1_000_000, 6)


def call_anthropic(cfg: dict, system: str, user: str) -> tuple[str, str, dict]:
    import anthropic

    # Las keys que no están asignadas a un workspace exigen el header anthropic-workspace-id.
    workspace = os.environ.get("ANTHROPIC_WORKSPACE_ID")
    headers = {"anthropic-workspace-id": workspace} if workspace else None
    client = anthropic.Anthropic(api_key=api_key_for("anthropic"), default_headers=headers)
    params = {
        "model": cfg["model"],
        "max_tokens": cfg.get("max_tokens", 16000),
        # El system prompt es igual para todas las llamadas: se cachea.
        "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": user}],
    }
    if "temperature" in cfg:
        # El SDK 1.x ya no expone temperature; solo los modelos antiguos (ej. Haiku 4.5) lo aceptan.
        params["extra_body"] = {"temperature": cfg["temperature"]}
    if "effort" in cfg:
        params["output_config"] = {"effort": cfg["effort"]}
    # Streaming: sobre ~21.000 tokens de salida el SDK exige stream (llamadas reales largas lo necesitan).
    with client.messages.stream(**params) as stream:
        response = stream.get_final_message()
    if response.stop_reason in ("max_tokens", "refusal"):
        raise RuntimeError(f"stop_reason={response.stop_reason}")
    text = "".join(block.text for block in response.content if block.type == "text")
    usage = {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "cache_write_tokens": response.usage.cache_creation_input_tokens or 0,
        "cache_read_tokens": response.usage.cache_read_input_tokens or 0,
    }
    return text, response.model, usage


def openai_client(provider: str):
    from openai import OpenAI

    return OpenAI(api_key=api_key_for(provider), base_url=OPENAI_COMPATIBLE[provider]["base_url"])


def audit_tool() -> dict:
    """La herramienta registrar_auditoria del doc del prompt, en formato de function calling."""
    from layer2_prompt import load_schema

    schema = load_schema()
    return {
        "type": "function",
        "function": {"name": schema["name"], "description": "Registra la auditoría de la llamada.", "parameters": schema["input_schema"]},
    }


def call_openai_compatible(cfg: dict, system: str, user: str) -> tuple[str, str, dict]:
    client = openai_client(cfg["provider"])
    params = {
        "model": cfg["model"],
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    if "temperature" in cfg:
        params["temperature"] = cfg["temperature"]
    if "max_tokens" in cfg:
        params["max_tokens"] = cfg["max_tokens"]
    if cfg.get("tool_mode"):
        # Se entrega registrar_auditoria como herramienta real y se obliga a usarla.
        tool = audit_tool()
        params["tools"] = [tool]
        params["tool_choice"] = {"type": "function", "function": {"name": tool["function"]["name"]}}
    elif cfg.get("json_mode", True):
        params["response_format"] = {"type": "json_object"}
    response = client.chat.completions.create(**params)
    choice = response.choices[0]
    if choice.finish_reason == "length":
        raise RuntimeError("finish_reason=length (respuesta cortada)")
    if cfg.get("tool_mode"):
        if not choice.message.tool_calls:
            raise RuntimeError("tool_mode: el modelo no llamó a la herramienta")
        text = choice.message.tool_calls[0].function.arguments
    else:
        text = choice.message.content or ""
    usage = {
        "input_tokens": response.usage.prompt_tokens if response.usage else 0,
        "output_tokens": response.usage.completion_tokens if response.usage else 0,
    }
    return text, response.model, usage


MAX_RETRIES = 3
RETRY_WAIT_SEC = 60


def is_transient(exc: Exception) -> bool:
    """Errores que vale la pena reintentar: alta demanda, límite por minuto, JSON inválido de la herramienta.
    No se reintenta si se acabó la cuota o el crédito: eso no se arregla esperando un minuto."""
    message = str(exc).lower()
    if "quota" in message or "credits" in message:
        return False
    status = getattr(exc, "status_code", None)
    return status in (413, 429, 500, 502, 503, 529) or "tool call validation failed" in message


def prompt_version() -> str | None:
    """Versión del prompt con que render.py o real_calls.py generaron los textos de PROMPTS_DIR."""
    path = PROMPTS_DIR / "prompt_version.txt"
    return path.read_text(encoding="utf-8").strip() if path.exists() else None


def run_one(cfg: dict, stem: str, system: str, force: bool) -> str:
    out_dir = RESULTS_DIR / cfg["name"]
    out_dir.mkdir(parents=True, exist_ok=True)
    result, meta_path, error_path = out_dir / f"{stem}.json", out_dir / f"{stem}.meta.json", out_dir / f"{stem}.error.txt"
    if result.exists() and not force:
        return "ya existe"
    user = (PROMPTS_DIR / f"{stem}.txt").read_text(encoding="utf-8")
    call = call_anthropic if cfg["provider"] == "anthropic" else call_openai_compatible
    attempt = 0
    while True:
        started = time.perf_counter()
        try:
            text, returned_model, usage = call(cfg, system, user)
            break
        except Exception as exc:  # noqa: BLE001 - se registra cualquier error del proveedor y se sigue
            attempt += 1
            if attempt <= MAX_RETRIES and is_transient(exc):
                wait = RETRY_WAIT_SEC * attempt
                print(f"   {stem}: {type(exc).__name__} transitorio, reintento {attempt}/{MAX_RETRIES} en {wait} s")
                time.sleep(wait)
                continue
            error_path.write_text(f"{type(exc).__name__}: {exc}\n", encoding="utf-8")
            return f"ERROR {type(exc).__name__}: {str(exc)[:150]}"
    latency_ms = int((time.perf_counter() - started) * 1000)
    error_path.unlink(missing_ok=True)
    result.write_text(text, encoding="utf-8")
    meta = {
        "name": cfg["name"],
        "provider": cfg["provider"],
        "prompt_version": prompt_version(),
        "requested_model": cfg["model"],
        "returned_model": returned_model,
        "settings": {k: cfg[k] for k in ("temperature", "effort", "json_mode", "tool_mode", "max_tokens") if k in cfg},
        "usage": usage,
        "cost_usd": cost_usd(cfg, usage),
        "latency_ms": latency_ms,
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cost = f"{meta['cost_usd']:.4f} USD" if meta["cost_usd"] is not None else "costo s/precio"
    return f"ok · {returned_model} · {latency_ms / 1000:.1f} s · {cost}"


def list_models(provider: str) -> None:
    if provider == "anthropic":
        import anthropic

        models = anthropic.Anthropic(api_key=api_key_for("anthropic")).models.list()
    else:
        models = openai_client(provider).models.list()
    for m in models:
        print(m.id)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--models", help="nombres separados por coma (default: todos los habilitados)")
    parser.add_argument("--calls", help="llamadas separadas por coma, ej. synth_01,synth_02 (default: todas)")
    parser.add_argument("--force", action="store_true", help="repetir aunque ya exista el resultado")
    parser.add_argument("--list-models", metavar="PROVIDER", help="listar IDs de modelo del proveedor y salir")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    if args.list_models:
        list_models(args.list_models)
        return

    if not (PROMPTS_DIR / "system.txt").exists():
        sys.exit("Faltan los prompts: corre primero python scripts/prompt_bench/render.py")
    system = (PROMPTS_DIR / "system.txt").read_text(encoding="utf-8")
    stems = args.calls.split(",") if args.calls else sorted(p.stem for p in PROMPTS_DIR.glob("synth_??.txt"))

    configs = tomllib.loads(CONFIG.read_text(encoding="utf-8"))["models"]
    wanted = set(args.models.split(",")) if args.models else None
    for cfg in configs:
        if wanted is not None and cfg["name"] not in wanted:
            continue
        if wanted is None and not cfg.get("enabled", True):
            continue
        if not cfg.get("model"):
            print(f"-- {cfg['name']}: sin 'model' en models.toml, se salta")
            continue
        if not api_key_for(cfg["provider"]):
            print(f"-- {cfg['name']}: falta la API key de {cfg['provider']} en .env, se salta")
            continue
        print(f"== {cfg['name']} ({cfg['provider']} · {cfg['model']})")
        for stem in stems:
            print(f"   {stem}: {run_one(cfg, stem, system, args.force)}")


if __name__ == "__main__":
    main()
