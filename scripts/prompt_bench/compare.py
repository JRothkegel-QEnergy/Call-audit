"""Compara las respuestas de distintas IA contra los hallazgos esperados de las llamadas sintéticas.

Uso:
    python scripts/prompt_bench/compare.py                 # compara results/
    python scripts/prompt_bench/compare.py <carpeta>       # compara otra carpeta, ej. una de archive/

Espera las respuestas en <carpeta>/<nombre-ia>/synth_NN.json (el JSON que devolvió la IA, tal cual;
se toleran bloques ```json y texto alrededor). Escribe <carpeta>/report.md.
"""

import json
import re
import sys
import tomllib
from pathlib import Path

from run import cost_usd

ROOT = Path(__file__).resolve().parents[2]
CALLS_DIR = ROOT / "tests" / "fixtures" / "calls"
RESULTS_DIR = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent / "results"

# Volumen de referencia del cliente (docs/context.md): ~100.000 llamadas al mes.
MONTHLY_CALLS = 100_000
BATCH_DISCOUNT = 0.5

STATUS_MAP = {"incumple": "non_compliant", "cumple": "compliant", "no_aplica": "not_applicable", "indeterminado": "uncertain"}


def parse_response(text: str) -> dict:
    text = re.sub(r"```(?:json)?", "", text)
    start, end = text.find("{"), text.rfind("}")
    data = json.loads(text[start : end + 1])
    return data.get("input", data)


def predicted(resp: dict) -> tuple[set[int], set[int]]:
    non_compliant, uncertain = set(), set()
    for c in resp.get("criterios", []):
        status = STATUS_MAP.get(str(c.get("estado", "")).lower())
        if status == "non_compliant":
            non_compliant.add(int(c["id"]))
        elif status == "uncertain":
            uncertain.add(int(c["id"]))
    return non_compliant, uncertain


def expected(call: dict) -> tuple[set[int], set[int]]:
    hard = {f["criterion_id"] for f in call["expected"]["findings"] if f["status"] == "non_compliant"}
    soft = {f["criterion_id"] for f in call["expected"]["findings"] if f["status"] != "non_compliant"}
    return hard, soft


NOTES = """## Notas

**Errores por plan gratuito.** Un 429 con "quota" o "credits" significa que se acabó la cuota del plan gratuito o el crédito
de la cuenta: no se arregla reintentando (hay que esperar que se renueve o pasar a un plan pagado). Un 503 ("high demand")
o un 413/429 por tokens por minuto son temporales: `run.py` los reintenta solo y basta con volver a correrlo.

**Cómo leer los costos.**
- Las llamadas sintéticas duran 1 a 3 minutos y las reales ~4: el input real va a ser mayor.
- En producción el system prompt se cachea (en Claude, la lectura de caché cuesta el 10 % del input), lo que baja el costo.
- Los modelos con razonamiento (Haiku 5.5, Gemini 3.8 Flash, gpt-oss) cobran el razonamiento como output. Bajar el
  esfuerzo (`effort`) o pedir comentario solo para los motivos que incumplen o quedan dudosos reduce el output.
- `docs/context.md` estimaba ~225 USD/mes para la capa 2 con Haiku 4.5 en batch. Con tokens reales la cifra es varias
  veces mayor: la estimación subestimaba el output (cada auditoría de 33 motivos genera miles de tokens).
- El descuento de batch (-50 %) aplica a Anthropic, Gemini y OpenAI. En Groq no está confirmado.

**Fuentes de precios (al 2026-10-08).** Anthropic: referencia oficial de la API. Gemini, OpenAI y Groq: agregadores de
precios, no las páginas oficiales; confirmar antes de presupuestar. Gemini 3.8 Flash tiene precio introductorio hasta el
2026-12-31 y desde 2027 sube a 1,50 / 7,50.
- Gemini 3.5 Flash-Lite: https://www.eesel.ai/blog/gemini-3-5-flash-lite-pricing · https://openrouter.ai/google/gemini-3.5-flash-lite
- Gemini 3.8 Flash: https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/ · https://www.mindstudio.ai/blog/gemini-3-8-flash-pricing
- gpt-oss-120b (Groq): https://pricepertoken.com/pricing-page/model/openai-gpt-oss-120b · https://www.cloudzero.com/blog/groq-pricing/
- GPT-6 Luna: https://venturebeat.com/technology/openai-releases-gpt-6-sol-and-luna-models-slashing-api-costs-50-or-more · https://openrouter.ai/openai/gpt-6-luna
- GPT-5.4 mini: https://pricepertoken.com/pricing-page/model/openai-gpt-5.4-mini
"""


def errors_section(models: list[Path]) -> list[str]:
    lines = ["", "## Llamadas con error", ""]
    any_error = False
    for model_dir in models:
        errors = sorted(model_dir.glob("synth_*.error.txt"))
        if not errors:
            continue
        any_error = True
        kinds: dict[str, list[str]] = {}
        for e in errors:
            text = e.read_text(encoding="utf-8")
            code = re.search(r"Error code: (\d+)", text)
            if "quota" in text.lower():
                kind = "429 cuota del plan agotada (no se arregla reintentando)"
            elif "credits" in text.lower():
                kind = "429 sin crédito en la cuenta"
            elif code and code.group(1) == "503":
                kind = "503 alta demanda del proveedor (temporal)"
            elif code and code.group(1) == "413":
                kind = "413 excede el límite de tokens por minuto del plan (temporal)"
            elif "validation failed" in text:
                kind = "JSON que no cumple el esquema"
            else:
                kind = text.strip().splitlines()[0][:120]
            kinds.setdefault(kind, []).append(e.name.split(".")[0])
        for kind, stems in kinds.items():
            lines.append(f"- **{model_dir.name}**: {kind} en {len(stems)} llamada(s): {', '.join(stems)}")
    if not any_error:
        lines.append("Ninguna.")
    return lines


def cl(x: float, decimals: int = 0) -> str:
    """Número en formato chileno: punto para miles, coma para decimales."""
    return f"{x:,.{decimals}f}".translate(str.maketrans(",.", ".,"))


def fmt_set(s: set[int]) -> str:
    return ", ".join(map(str, sorted(s))) or "—"


def main() -> None:
    calls = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(CALLS_DIR.glob("synth_*.json"))}
    models = sorted(d for d in RESULTS_DIR.iterdir() if d.is_dir()) if RESULTS_DIR.exists() else []
    if not models:
        print(f"No hay resultados. Guarda las respuestas en {RESULTS_DIR}/<nombre-ia>/synth_NN.json")
        return

    lines = ["# Comparación de IA · prompt capa 2", ""]
    lines += [
        "- **TP**: motivo esperado como incumplido que la IA marcó `incumple`.",
        "- **FP**: la IA marcó `incumple` un motivo que no se esperaba (excluye los esperados inciertos).",
        "- **FN**: motivo esperado como incumplido que la IA no marcó `incumple`.",
        "- **Veredicto de llamada**: `no cumple` si hay al menos un `incumple`. Las llamadas esperadas `uncertain` no cuentan.",
        "",
        "## Resumen por IA",
        "",
        "| IA | Modelo (según API) | Llamadas respondidas | Precisión motivos | Recall motivos | FP llamadas | FN llamadas | Gestiones correctas | Objeciones correctas | Latencia prom. |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    configs = {c["name"]: c for c in tomllib.loads((Path(__file__).resolve().parent / "models.toml").read_text(encoding="utf-8"))["models"]}
    cost_lines = [
        "",
        "## Costos por IA",
        "",
        f"Calculado con los tokens reales de cada respuesta y los precios de `models.toml`. La proyección usa {cl(MONTHLY_CALLS)} llamadas al mes"
        + " y el costo promedio por llamada de estas pruebas (las llamadas sintéticas son más cortas que las reales, de ~4 min).",
        "",
        "| IA | Precio input / output (USD por M tokens) | Tokens prom. por llamada (in / out) | Costo por llamada USD | Costo de las 11 pruebas USD | Mensual USD | Mensual con batch (-50 %) USD |",
        "|---|---|---|---|---|---|---|",
    ]
    grid: dict[str, dict[str, str]] = {stem: {} for stem in calls}
    for model_dir in models:
        model = model_dir.name
        tp = fp = fn = answered = 0
        call_fp = call_fn = call_neg = call_pos = 0
        outcome_ok = outcome_total = obj_ok = obj_total = 0
        returned_models, costs, latencies, tokens_in, tokens_out = set(), [], [], [], []
        cfg = configs.get(model, {})
        for stem, call in calls.items():
            path = model_dir / f"{stem}.json"
            if not path.exists():
                grid[stem][model] = "(sin respuesta)"
                continue
            try:
                resp = parse_response(path.read_text(encoding="utf-8"))
            except (ValueError, json.JSONDecodeError) as exc:
                grid[stem][model] = f"JSON inválido: {exc}"
                continue
            answered += 1
            meta_path = model_dir / f"{stem}.meta.json"
            if meta_path.exists():
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                returned_models.add(meta.get("returned_model") or "?")
                usage = meta.get("usage") or {}
                if usage:
                    tokens_in.append(usage.get("input_tokens", 0) + usage.get("cache_write_tokens", 0) + usage.get("cache_read_tokens", 0))
                    tokens_out.append(usage.get("output_tokens", 0))
                    cost = cost_usd(cfg, usage)
                    if cost is not None:
                        costs.append(cost)
                latencies.append(meta.get("latency_ms", 0))
            pred_nc, pred_unc = predicted(resp)
            exp_nc, exp_soft = expected(call)
            tp += len(pred_nc & exp_nc)
            fp += len(pred_nc - exp_nc - exp_soft)
            fn += len(exp_nc - pred_nc)
            cell = f"incumple: {fmt_set(pred_nc)}"
            if pred_unc:
                cell += f" · indet.: {fmt_set(pred_unc)}"
            grid[stem][model] = cell

            verdict = call["expected"]["call_verdict"]
            if verdict == "compliant":
                call_neg += 1
                call_fp += bool(pred_nc)
            elif verdict == "non_compliant":
                call_pos += 1
                call_fn += not pred_nc

            got = {g.get("n_poliza"): g for g in resp.get("gestiones", [])}
            for exp in call["expected"]["outcomes"]:
                g = got.get(exp["policy_number"], {})
                outcome_total += 1
                outcome_ok += g.get("resultado_grabacion") == exp["outcome"]
                obj_total += 1
                obj_ok += g.get("n_objeciones") == exp["objections"]

        precision = f"{tp / (tp + fp):.0%}" if tp + fp else "—"
        recall = f"{tp / (tp + fn):.0%}" if tp + fn else "—"
        model_cell = ", ".join(sorted(returned_models)) or ("(manual)" if answered else "—")
        latency_cell = f"{sum(latencies) / len(latencies) / 1000:.1f} s" if latencies else "—"
        lines.append(
            f"| {model} | {model_cell} | {answered}/{len(calls)} | {precision} | {recall} | {call_fp}/{call_neg} | {call_fn}/{call_pos} "
            f"| {outcome_ok}/{outcome_total} | {obj_ok}/{obj_total} | {latency_cell} |"
        )
        price = f"{cl(cfg['price_input_per_mtok'], 2)} / {cl(cfg['price_output_per_mtok'], 2)}" if "price_input_per_mtok" in cfg else "sin precio"
        tok = f"{cl(sum(tokens_in) / len(tokens_in))} / {cl(sum(tokens_out) / len(tokens_out))}" if tokens_in else "—"
        if costs:
            per_call = sum(costs) / len(costs)
            monthly = per_call * MONTHLY_CALLS
            cost_lines.append(
                f"| {model} | {price} | {tok} | {cl(per_call, 4)} | {cl(per_call * len(calls), 3)} | {cl(monthly)} | {cl(monthly * BATCH_DISCOUNT)} |"
            )
        else:
            cost_lines.append(f"| {model} | {price} | {tok} | — | — | — | — |")

    lines += cost_lines
    lines += errors_section(models)
    lines += ["", "## Detalle por llamada", "", "| Llamada | Esperado | " + " | ".join(m.name for m in models) + " |"]
    lines.append("|---|---|" + "---|" * len(models))
    for stem, call in calls.items():
        exp_nc, exp_soft = expected(call)
        exp_cell = f"incumple: {fmt_set(exp_nc)}" + (f" · inciertos: {fmt_set(exp_soft)}" if exp_soft else "")
        row = [f"{call['call_id']} · {call['title']}", exp_cell] + [grid[stem].get(m.name, "") for m in models]
        lines.append("| " + " | ".join(row) + " |")

    lines += ["", "Ojo: los esperados los definimos nosotros, no auditores del cliente. Esto mide consistencia entre IA, no precisión real.", "", NOTES.strip()]
    report = RESULTS_DIR / "report.md"
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\nReporte: {report}")


if __name__ == "__main__":
    main()
