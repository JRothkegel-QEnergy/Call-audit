"""Compara las respuestas de distintas IA contra los hallazgos esperados de las llamadas sintéticas.

Uso:
    python scripts/prompt_bench/compare.py

Espera las respuestas en scripts/prompt_bench/results/<nombre-ia>/synth_NN.json (el JSON que devolvió
la IA, tal cual; se toleran bloques ```json y texto alrededor). Escribe results/report.md.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CALLS_DIR = ROOT / "tests" / "fixtures" / "calls"
RESULTS_DIR = Path(__file__).resolve().parent / "results"

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
        "| IA | Llamadas respondidas | Precisión motivos | Recall motivos | FP llamadas | FN llamadas | Gestiones correctas | Objeciones correctas |",
        "|---|---|---|---|---|---|---|---|",
    ]
    grid: dict[str, dict[str, str]] = {stem: {} for stem in calls}
    for model_dir in models:
        model = model_dir.name
        tp = fp = fn = answered = 0
        call_fp = call_fn = call_neg = call_pos = 0
        outcome_ok = outcome_total = obj_ok = obj_total = 0
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
        lines.append(
            f"| {model} | {answered}/{len(calls)} | {precision} | {recall} | {call_fp}/{call_neg} | {call_fn}/{call_pos} "
            f"| {outcome_ok}/{outcome_total} | {obj_ok}/{obj_total} |"
        )

    lines += ["", "## Detalle por llamada", "", "| Llamada | Esperado | " + " | ".join(m.name for m in models) + " |"]
    lines.append("|---|---|" + "---|" * len(models))
    for stem, call in calls.items():
        exp_nc, exp_soft = expected(call)
        exp_cell = f"incumple: {fmt_set(exp_nc)}" + (f" · inciertos: {fmt_set(exp_soft)}" if exp_soft else "")
        row = [f"{call['call_id']} · {call['title']}", exp_cell] + [grid[stem].get(m.name, "") for m in models]
        lines.append("| " + " | ".join(row) + " |")

    lines += ["", "Ojo: los esperados los definimos nosotros, no auditores del cliente. Esto mide consistencia entre IA, no precisión real."]
    report = RESULTS_DIR / "report.md"
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\nReporte: {report}")


if __name__ == "__main__":
    main()
