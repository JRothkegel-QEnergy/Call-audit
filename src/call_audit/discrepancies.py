"""Tabla de discrepancias: paso 1 de la cuarta IA (docs/plan-ia-discrepancias.md). Sin IA y solo lectura.

Cruza, por llamada × motivo, la corrida vigente de la IA con los dos revisores:

- Excel del cliente: veredicto (ESTADO_CALIDAD), COMENTARIO y NO CUMPLE por motivo (C01..C33).
- Revisión manual Qubico: revisiones de la app, clasificaciones del árbol de discrepancias, notas y, opcional, la
  auditoría del dashboard (revision_capa2.csv) para las llamadas que no quedaron como clasificación.

Deja en --out (fuera del repo):
- discrepancies.jsonl: un caso por llamada × motivo donde la IA o el cliente marcan algo (fp, fn, ai_uncertain,
  match_fail), con el contexto que necesita el paso 2.
- transcripts.jsonl: la transcripción completa de esas llamadas. Los fn no traen cita de la IA (dijo
  «cumple»), así que el paso 2 los revisa sobre la llamada entera.
- summary.csv y summary.md: conteos por motivo y matriz de veredicto de llamada.

    DATABASE_URL=... uv run python -m call_audit.discrepancies --out ../transcripts/discrepancies/2026-11-05 \
        [--manual-csv ../transcripts/layer2_real_100_v2.7/revision_capa2.csv]
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit.ingestion.import_bench import VERDICTS, real_calls
from call_audit.persistence.db import get_sessionmaker
from call_audit.persistence.models import Case, DiscrepancyClassification, Note, Review

PROMPT_SPEC = Path(__file__).resolve().parents[2] / "prompts" / "layer2" / "prompt.yaml"
CRITERIA = range(1, 34)
# Tramo de transcripción que acompaña a cada caso, alrededor de la cita de la IA.
CONTEXT_MS = 30_000
FAIL = "non_compliant"
UNSURE = "uncertain"
# Orden de los tipos en el resumen: lo que más interesa primero.
KINDS = ("fp", "fn", "ai_uncertain", "match_fail", "match_ok")


def criterion_rules(spec_path: Path = PROMPT_SPEC) -> tuple[str, dict[int, str]]:
    """Versión del prompt y texto de cada motivo (oficial + criterio Qubico), como lo ve el modelo."""
    spec = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    rules = {}
    for section in spec["sections"]:
        for item in section["items"]:
            if "number" in item:
                text = item["official"].strip()
                if item.get("criterion"):
                    text += f"\nCriterio: {item['criterion'].strip()}"
                rules[int(item["number"])] = text
    return str(spec["version"]), rules


def excerpt(transcript: list[dict], start_ms: int | None, end_ms: int | None) -> list[dict]:
    """Turnos que tocan la ventana de ±CONTEXT_MS alrededor de la cita."""
    if start_ms is None:
        return []
    lo, hi = start_ms - CONTEXT_MS, (end_ms or start_ms) + CONTEXT_MS
    return [t for t in transcript if t.get("endMs", 0) >= lo and t.get("startMs", 0) <= hi]


def kind_of(ai: str, excel_fail: bool) -> str:
    if ai == UNSURE:
        return "ai_uncertain"
    if ai == FAIL:
        return "match_fail" if excel_fail else "fp"
    return "fn" if excel_fail else "match_ok"


def load_manual_csv(path: Path | None) -> dict[str, dict]:
    """Auditoría del dashboard por llamada: veredicto (APROBADA/RECHAZADA) y nota."""
    if path is None:
        return {}
    out = {}
    with path.open(encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            verdict = VERDICTS.get(r.get("mi_veredicto", "").strip().upper())
            if verdict:
                out[r["llamada"].strip()] = {"verdict": verdict, "note": (r.get("nota") or "").strip()}
    return out


def manual_view(
    review: Review | None,
    classification: DiscrepancyClassification | None,
    notes: list[Note],
    csv_row: dict | None,
    ai_verdict: str,
) -> dict:
    """Lo que dijo la revisión manual Qubico de la llamada, venga de donde venga."""
    by_criterion: dict[int, dict] = {}
    if review is not None:
        for item in review.items:
            by_criterion[int(item["criterionId"])] = {
                "verdict": item["verdict"],
                "action": item["action"],
                "reason": item.get("correctionReason"),
                "comment": item.get("comment"),
            }
    call_verdict, sources = None, []
    if review is not None:
        call_verdict = review.final_verdict
        sources.append("app_review")
    if classification is not None and classification.classification:
        sources.append("classification")
        if call_verdict is None and ai_verdict in (FAIL, "compliant"):
            # «La IA acertó» = el veredicto de la IA; «se equivocó» = el contrario (con IA dudosa no se puede saber).
            other = "compliant" if ai_verdict == FAIL else FAIL
            call_verdict = ai_verdict if classification.classification == "ai_correct" else other
    if csv_row is not None:
        sources.append("dashboard_csv")
        call_verdict = call_verdict or csv_row["verdict"]
    note_texts = [n.text for n in notes if n.scope == "case"]
    if classification is not None and classification.note:
        note_texts.append(classification.note)
    if csv_row is not None and csv_row["note"] and (classification is None or csv_row["note"] != classification.note):
        note_texts.append(csv_row["note"])
    finding_notes: dict[int, list[str]] = defaultdict(list)
    for n in notes:
        if n.scope == "finding" and n.criterion_id is not None:
            finding_notes[n.criterion_id].append(n.text)
    return {
        "sources": sources,
        "call_verdict": call_verdict,
        "classification": classification.classification if classification is not None else None,
        "classification_criteria": list(classification.criterion_ids) if classification is not None else [],
        "notes": note_texts,
        "by_criterion": by_criterion,
        "finding_notes": dict(finding_notes),
    }


def sides_with(manual: str | None, ai_fail: bool, excel_fail: bool) -> str | None:
    """A quién le da la razón la revisión manual: ai | excel | none (ninguno) | None (no hay revisión)."""
    if manual is None or manual == UNSURE:
        return None
    manual_fail = manual == FAIL
    if manual_fail == ai_fail and manual_fail != excel_fail:
        return "ai"
    if manual_fail == excel_fail and manual_fail != ai_fail:
        return "excel"
    return "none"


def build(session: Session, manual_csv: dict[str, dict]) -> tuple[list[dict], dict[str, list[dict]], dict]:
    """Casos de discrepancia, transcripciones de sus llamadas y conteos para el resumen."""
    prompt_version, rules = criterion_rules()
    reviews = {r.case_id: r for r in session.scalars(select(Review))}
    classifications = {c.case_id: c for c in session.scalars(select(DiscrepancyClassification))}
    notes: dict[str, list[Note]] = defaultdict(list)
    for n in session.scalars(select(Note)):
        notes[n.case_id].append(n)

    rows: list[dict] = []
    transcripts: dict[str, list[dict]] = {}
    by_evaluator: dict[str, Counter] = defaultdict(Counter)
    counts: dict[int, Counter] = defaultdict(Counter)
    calls = Counter()
    skipped = Counter()
    for case in session.scalars(select(Case).order_by(Case.call_id)):
        run = next((r for r in case.runs if r.is_current), None)
        if run is None or run.error:
            skipped["sin corrida vigente"] += 1
            continue
        if case.external_item_fails is None:
            skipped["sin marca por motivo del cliente"] += 1
            continue
        excel_fails = {int(x) for x in case.external_item_fails}
        findings = {int(f["criterionId"]): f for f in run.findings}
        ai_call_fail = run.verdict == FAIL
        excel_call_fail = case.external_verdict == FAIL
        manual = manual_view(
            reviews.get(case.id),
            classifications.get(case.id),
            notes.get(case.id, []),
            manual_csv.get(case.call_id),
            run.verdict,
        )
        calls[(run.verdict, case.external_verdict or "none")] += 1
        evaluator = (case.call_metadata or {}).get("external_evaluator")
        call_info = {
            "call_id": case.call_id,
            "case_id": case.id,
            "call_date": case.call_date,
            "excel_evaluator": evaluator,
            "model": run.model,
            "run_label": run.run_label,
            "prompt_version": run.prompt_version,
            "duration_sec": (case.call_metadata or {}).get("duration_sec"),
            "ai_call_verdict": run.verdict,
            "excel_call_verdict": case.external_verdict,
            "excel_comment": case.external_comment,
            "excel_fails": sorted(excel_fails),
            "ai_fails": sorted(c for c, f in findings.items() if f["verdict"] == FAIL),
            "manual_call_verdict": manual["call_verdict"],
            "manual_call_sides_with": sides_with(manual["call_verdict"], ai_call_fail, excel_call_fail),
            "manual_sources": manual["sources"],
            "manual_notes": manual["notes"],
        }
        n_rows = len(rows)
        for cid in CRITERIA:
            f = findings.get(cid, {})
            ai = f.get("verdict", "not_applicable")
            excel_fail = cid in excel_fails
            kind = kind_of(ai, excel_fail)
            counts[cid][kind] += 1
            by_evaluator[evaluator or "sin dato"][kind] += 1
            item_manual = manual["by_criterion"].get(cid)
            if item_manual:
                counts[cid]["manual"] += 1
            if kind == "match_ok":
                continue
            ev = f.get("evidence") or {}
            meta = case.call_metadata or {}
            rows.append(
                {
                    **call_info,
                    "criterion_id": cid,
                    "criterion_name": real_calls.CRITERIA.get(cid),
                    "kind": kind,
                    "ai_verdict": ai,
                    "ai_confidence": f.get("confidence"),
                    "ai_comment": f.get("comment") or "",
                    "ai_quotes": [
                        {
                            "quote": e.get("quote") or "",
                            "startMs": e.get("startMs"),
                            "validated": e.get("quoteValidated"),
                        }
                        for e in [ev, *(f.get("moreEvidence") or [])]
                        if e.get("quote")
                    ],
                    "excel_fail": excel_fail,
                    "manual_item": item_manual,
                    "manual_item_sides_with": sides_with(item_manual["verdict"], ai == FAIL, excel_fail)
                    if item_manual
                    else None,
                    "manual_flagged_criterion": cid in manual["classification_criteria"],
                    "manual_finding_notes": manual["finding_notes"].get(cid, []),
                    "rule": rules.get(cid),
                    "rule_prompt_version": prompt_version,
                    "typification": meta.get("typification") if cid >= 18 else None,
                    "holds_sec": meta.get("holds_sec") if cid == 1 else None,
                    "transcript_excerpt": [
                        {"speaker": t["speaker"], "startMs": t["startMs"], "text": t["text"]}
                        for t in excerpt(case.transcript, ev.get("startMs"), ev.get("endMs"))
                    ],
                }
            )
        ev_calls = by_evaluator[evaluator or "sin dato"]
        ev_calls["calls"] += 1
        ev_calls["call_match"] += run.verdict == (case.external_verdict or "none")
        ev_calls["excel_call_fail"] += excel_call_fail
        if len(rows) > n_rows:
            transcripts[case.call_id] = [
                {"speaker": t["speaker"], "startMs": t["startMs"], "text": t["text"]} for t in case.transcript
            ]
    summary = {
        "counts": counts,
        "calls": calls,
        "by_evaluator": by_evaluator,
        "skipped": skipped,
        "prompt_version": prompt_version,
        "n_calls": sum(calls.values()),
    }
    return rows, transcripts, summary


def pct(a: int, b: int) -> str:
    return f"{100 * a / b:.0f} %" if b else "—"


def criterion_table(counts: dict[int, Counter]) -> list[dict]:
    """Una fila por motivo con los conteos del resumen (también la usa la vista del admin)."""
    table = []
    for cid in CRITERIA:
        c = counts[cid]
        table.append(
            {
                "criterion_id": cid,
                "criterion_name": real_calls.CRITERIA.get(cid),
                "excel_fail": c["fn"] + c["match_fail"],
                "ai_fail": c["fp"] + c["match_fail"],
                "match_fail": c["match_fail"],
                "fp": c["fp"],
                "fn": c["fn"],
                "ai_uncertain": c["ai_uncertain"],
                "disagreements": c["fp"] + c["fn"] + c["ai_uncertain"],
                "manual_items": c["manual"],
            }
        )
    return table


def write_summary(out: Path, rows: list[dict], summary: dict) -> None:
    n = summary["n_calls"]
    table = criterion_table(summary["counts"])
    with (out / "summary.csv").open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(table[0]))
        w.writeheader()
        w.writerows(table)

    sides = Counter(r["manual_call_sides_with"] for r in {r["call_id"]: r for r in rows}.values())
    calls = summary["calls"]
    lines = [
        f"# Tabla de discrepancias · {date.today().isoformat()}",
        "",
        f"{n} llamadas con corrida vigente y marca por motivo del cliente. "
        f"Reglas citadas: prompt v{summary['prompt_version']}.",
        "",
        "- **fp:** la IA marca No cumple y el Excel no. **fn:** el Excel marca No cumple y la IA no.",
        "- **ai_uncertain:** la IA quedó dudosa. **match_fail:** los dos marcan No cumple.",
        "",
        "## Veredicto de llamada (IA × Excel)",
        "",
        "| IA \\ Excel | compliant | non_compliant | sin veredicto |",
        "|---|---|---|---|",
    ]
    for ai in ("compliant", FAIL, UNSURE):
        lines.append(f"| {ai} | {calls[(ai, 'compliant')]} | {calls[(ai, FAIL)]} | {calls[(ai, 'none')]} |")
    agree = calls[("compliant", "compliant")] + calls[(FAIL, FAIL)]
    lines += [
        "",
        f"Calce de llamada: {agree} de {n} ({pct(agree, n)}).",
        "",
        "## Por motivo (ordenado por desacuerdos)",
        "",
        "| Motivo | Excel NO CUMPLE | IA NO CUMPLE | Ambos | fp | fn | IA dudosa | Revisión manual |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for t in sorted(table, key=lambda t: -t["disagreements"]):
        if t["excel_fail"] or t["ai_fail"] or t["ai_uncertain"]:
            lines.append(
                f"| {t['criterion_id']} · {t['criterion_name']} | {t['excel_fail']} | {t['ai_fail']} "
                f"| {t['match_fail']} | {t['fp']} | {t['fn']} | {t['ai_uncertain']} | {t['manual_items']} |"
            )
    lines += [
        "",
        "## Revisión manual Qubico (por llamada con algún caso)",
        "",
        f"- Le da la razón a la IA: {sides['ai']}",
        f"- Le da la razón al Excel: {sides['excel']}",
        f"- Coinciden IA y Excel, o la revisión no se alinea con ninguno: {sides['none']}",
        f"- Sin revisión manual: {sides[None]}",
        "",
        "## Por evaluador del cliente",
        "",
    ]
    by_evaluator = summary["by_evaluator"]
    if set(by_evaluator) <= {"sin dato"}:
        lines.append("El Excel de estas llamadas no trae EVALUADOR_CALIDAD.")
    else:
        lines += [
            "Un evaluador que marca mucho más (o menos) que el resto, con la IA pareja, apunta a una diferencia de"
            " criterio del evaluador, no del prompt.",
            "",
            "| Evaluador | Llamadas | Rechaza (Excel) | Calce IA | Excel NO CUMPLE por llamada | fp | fn |",
            "|---|---|---|---|---|---|---|",
        ]
        for ev, c in sorted(by_evaluator.items(), key=lambda kv: -kv[1]["calls"]):
            marks = c["fn"] + c["match_fail"]
            lines.append(
                f"| {ev} | {c['calls']} | {pct(c['excel_call_fail'], c['calls'])} | {pct(c['call_match'], c['calls'])} "
                f"| {marks / c['calls']:.2f} | {c['fp']} | {c['fn']} |"
            )
    if summary["skipped"]:
        lines += ["", "## Llamadas fuera de la tabla", ""]
        lines += [f"- {k}: {v}" for k, v in summary["skipped"].items()]
    (out / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True, help="carpeta de salida, fuera del repo")
    parser.add_argument("--manual-csv", type=Path, help="revision_capa2.csv del dashboard")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    with get_sessionmaker()() as session:
        rows, transcripts, summary = build(session, load_manual_csv(args.manual_csv))
    with (args.out / "discrepancies.jsonl").open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False, default=_json_default) + "\n")
    with (args.out / "transcripts.jsonl").open("w", encoding="utf-8") as fh:
        for call_id, turns in transcripts.items():
            fh.write(json.dumps({"call_id": call_id, "turns": turns}, ensure_ascii=False) + "\n")
    write_summary(args.out, rows, summary)
    kinds = Counter(r["kind"] for r in rows)
    print(
        f"{summary['n_calls']} llamadas, {len(rows)} casos: " + ", ".join(f"{k} {kinds[k]}" for k in KINDS if kinds[k])
    )
    print(f"Listo en {args.out}")


def _json_default(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError(type(value))


if __name__ == "__main__":
    main()
