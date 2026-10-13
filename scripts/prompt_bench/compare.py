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

from run import cost_usd, extract_audit

ROOT = Path(__file__).resolve().parents[2]
CALLS_DIR = ROOT / "tests" / "fixtures" / "calls"
RESULTS_DIR = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent / "results"

# Volumen de referencia del cliente (docs/context.md): ~100.000 llamadas al mes.
MONTHLY_CALLS = 100_000
BATCH_DISCOUNT = 0.5
# Metas del proyecto (docs/context.md): hasta 5 % de falsos positivos y hasta 20 % de falsos negativos.
GOAL_FALSE_ALARMS = 0.05
GOAL_MISSED = 0.20

PLATFORMS = {
    "anthropic": "Anthropic API (directo)",
    "openai": "OpenAI API (directo)",
    "gemini": "Google Gemini API (directo)",
    "groq": "Groq",
    "openrouter": "OpenRouter (intermediario)",
    "ollama": "Ollama (local)",
}

STATUS_MAP = {"incumple": "non_compliant", "cumple": "compliant", "no_aplica": "not_applicable", "indeterminado": "uncertain"}


def parse_response(text: str) -> dict:
    return extract_audit(text)


def predicted(resp: dict) -> tuple[set[int], set[int]]:
    non_compliant, uncertain = set(), set()
    for c in resp.get("criterios", []):
        if not isinstance(c, dict) or not str(c.get("id", "")).isdigit():
            continue
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
- **Duración de las llamadas:** las sintéticas duran en promedio ~2 minutos (entre 1 y 7), mientras que las reales
  duran más de 10. La transcripción real es unas 5 veces más larga, así que el input por llamada va a ser bastante
  mayor (el system prompt, de ~5.000 tokens, es fijo; la ficha del seguro suma entre 0 y ~4.000 tokens según el
  producto) y el output probablemente también, por las citas y comentarios.
  Los costos de esta tabla subestiman el costo por llamada real.
- **Volumen:** la proyección usa 100.000 llamadas al mes, que sale de ~400.000 minutos con llamadas de ~4 min. Si las
  llamadas duran más de 10 minutos, esos mismos minutos son ~40.000 llamadas: menos llamadas, pero más caras cada una.
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


def reasons_match(got, expected: list[str]) -> bool:
    """Basta con que la IA encuentre uno de los motivos esperados (la pauta acepta cualquiera de los que dijo el cliente).
    Si no se esperan motivos, la IA no debe dar ninguno distinto de "No informado"."""
    got = {str(r).strip().lower() for r in got or [] if str(r).strip().lower() != "no informado"}
    if not expected:
        return not got
    return bool(got & {r.lower() for r in expected})


def renewal_last(arguments) -> bool:
    """True si no hay argumento de fecha de renovación o si es el último."""
    kinds = [a.get("tipo") for a in arguments or [] if isinstance(a, dict)]
    return "FECHA_RENOVACION" not in kinds or kinds[-1] == "FECHA_RENOVACION" and kinds.index("FECHA_RENOVACION") == len(kinds) - 1


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
        "- **Precisión** = TP / (TP + FP): de los motivos que la IA marcó `incumple`, qué % era correcto. 100 % − precisión = falsas alarmas.",
        "- **Recall** (sensibilidad) = TP / (TP + FN): de los incumplimientos reales, qué % encontró la IA. 100 % − recall = incumplimientos que se le escapan.",
        "",
        "## Resumen por IA",
        "",
        "| IA | Plataforma | Modelo (según API) | Llamadas respondidas | Precisión motivos | Recall motivos | FP llamadas | FN llamadas | Gestiones correctas | Motivo de renuncia | Objeciones correctas | Orden de argumentos | Latencia prom. |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    configs = {c["name"]: c for c in tomllib.loads((Path(__file__).resolve().parent / "models.toml").read_text(encoding="utf-8"))["models"]}
    cost_lines = [
        "",
        "## Costos por IA",
        "",
        f"Calculado con los tokens reales de cada respuesta y los precios de `models.toml`. La proyección usa {cl(MONTHLY_CALLS)} llamadas al mes"
        + " y el costo promedio por llamada de estas pruebas. Ojo: estas llamadas duran ~2 min y las reales más de 10 (ver Notas).",
        "",
        f"| IA | Plataforma | Precio input / output (USD por M tokens) | Tokens prom. por llamada (in / out) | Costo por llamada USD | Costo de las {len(calls)} pruebas USD | Mensual USD | Mensual con batch (-50 %) USD |",
        "|---|---|---|---|---|---|---|---|",
    ]
    grid: dict[str, dict[str, str]] = {stem: {} for stem in calls}
    quality_rows: list[str] = []
    for model_dir in models:
        model = model_dir.name
        tp = fp = fn = answered = unc = unc_ok = 0
        call_fp = call_fn = call_neg = call_pos = 0
        outcome_ok = outcome_total = obj_ok = obj_total = reason_ok = reason_total = order_ok = order_total = 0
        returned_models, costs, latencies, tokens_in, tokens_out = set(), [], [], [], []
        cfg = configs.get(model, {})
        platform = PLATFORMS.get(cfg.get("provider"), "manual")
        for stem, call in calls.items():
            path = model_dir / f"{stem}.json"
            if not path.exists():
                grid[stem][model] = "(sin respuesta)"
                continue
            try:
                resp = parse_response(path.read_text(encoding="utf-8"))
            except (ValueError, json.JSONDecodeError) as exc:
                grid[stem][model] = f"respuesta inválida: {exc}"
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
            unc += len(pred_unc)
            unc_ok += len(pred_unc & (exp_soft | exp_nc))
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

            got = {str(g.get("mus_a_neto")): g for g in resp.get("gestiones", []) if isinstance(g, dict)}
            for exp in call["expected"]["outcomes"]:
                g = got.get(exp["mus_a_neto"], {})
                outcome_total += 1
                outcome_ok += g.get("resultado_grabacion") == exp["outcome"]
                obj_total += 1
                obj_ok += g.get("n_objeciones") == exp["objections"]
                reason_total += 1
                reason_ok += reasons_match(g.get("motivos_renuncia"), exp["cancellation_reasons"])
                if "renewal_last" in exp:
                    order_total += 1
                    order_ok += renewal_last(g.get("argumentos_retencion")) == exp["renewal_last"]

        precision = f"{tp / (tp + fp):.0%}" if tp + fp else "—"
        recall = f"{tp / (tp + fn):.0%}" if tp + fn else "—"
        if tp + fp and tp + fn:
            p_val, r_val = tp / (tp + fp), tp / (tp + fn)
            f1 = 2 * p_val * r_val / (p_val + r_val) if p_val + r_val else 0
            goal = "sí" if 1 - p_val <= GOAL_FALSE_ALARMS and 1 - r_val <= GOAL_MISSED else "no"
            quality_rows.append(
                f"| {model} | {platform} | {tp} | {fp} | {fn} | {p_val:.0%} | {1 - p_val:.0%} | {r_val:.0%} | {1 - r_val:.0%} | {f1:.0%} | {unc} ({unc - unc_ok} sin motivo) | {goal} |"
            )
        model_cell = ", ".join(sorted(returned_models)) or ("(manual)" if answered else "—")
        latency_cell = f"{sum(latencies) / len(latencies) / 1000:.1f} s" if latencies else "—"
        lines.append(
            f"| {model} | {platform} | {model_cell} | {answered}/{len(calls)} | {precision} | {recall} | {call_fp}/{call_neg} | {call_fn}/{call_pos} "
            f"| {outcome_ok}/{outcome_total} | {reason_ok}/{reason_total} | {obj_ok}/{obj_total} | {order_ok}/{order_total} | {latency_cell} |"
        )
        price = f"{cl(cfg['price_input_per_mtok'], 2)} / {cl(cfg['price_output_per_mtok'], 2)}" if "price_input_per_mtok" in cfg else "sin precio"
        tok = f"{cl(sum(tokens_in) / len(tokens_in))} / {cl(sum(tokens_out) / len(tokens_out))}" if tokens_in else "—"
        if costs:
            per_call = sum(costs) / len(costs)
            monthly = per_call * MONTHLY_CALLS
            cost_lines.append(
                f"| {model} | {platform} | {price} | {tok} | {cl(per_call, 4)} | {cl(per_call * len(calls), 3)} | {cl(monthly)} | {cl(monthly * BATCH_DISCOUNT)} |"
            )
        else:
            cost_lines.append(f"| {model} | {platform} | {price} | {tok} | — | — | — | — |")

    lines += [
        "",
        "## Detalle de precisión",
        "",
        "Cómo leerla: la meta del proyecto es **hasta 5 % de falsos positivos y hasta 20 % de falsos negativos** (`docs/context.md`).",
        "A nivel de motivo, eso equivale a **precisión ≥ 95 %** (falsas alarmas ≤ 5 %) y **recall ≥ 80 %** (omisiones ≤ 20 %).",
        "La precisión es la que más pesa en costo operativo: cada falsa alarma es una llamada que un auditor revisa sin necesidad.",
        "El recall pesa en riesgo: cada omisión es un incumplimiento real que no llega a revisión.",
        "**F1** resume ambas en un número (media armónica); sirve para ordenar, pero la decisión se toma con la meta.",
        "**Indeterminados** van a revisión humana: no son error, pero cuestan horas de auditor. \"Sin motivo\" = indeterminados en motivos que no se esperaban ni como inciertos.",
        f"Ojo con el tamaño: hay {sum(len(expected(c)[0]) for c in calls.values())} incumplimientos esperados en {len(calls)} llamadas; un solo motivo de diferencia mueve la precisión o el recall en ~4 puntos.",
        "",
        "| IA | Plataforma | TP | FP | FN | Precisión | Falsas alarmas | Recall | Omisiones | F1 | Indeterminados | Cumple meta |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ] + quality_rows
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
