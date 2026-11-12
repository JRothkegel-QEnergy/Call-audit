"""Acuerdo IA vs revisor de una prueba, partido en los colores del mosaico (docs/ux/admin-prompt-metrics §11).

Sin IA: cruza los resultados de la prueba con la planilla del revisor y, si hay análisis de causa ("attribution") de
esa prueba, marca como "inconsistencia del revisor" los desacuerdos que todos sus patrones atribuyen al auditor (D2).

Dos unidades con el mismo bloque de conteos:
- byCall: una llamada. agree = mismo veredicto; undecided = la IA quedó dudosa; el resto es desacuerdo: azul si todos
  sus motivos en desacuerdo son azules; si no, promptFn (IA Cumple / revisor No cumple) o promptFp (al revés).
- byCallCriterion: llamada × motivo. El "no aplica" de la IA cuenta como cumple; dudoso = undecided.

Cuadra con golden_split.call_rates: agree/n = callMatchRate, promptFn + reviewerFn = fnCount, promptFp + reviewerFp =
fpCount, sobre las mismas llamadas (las que traen marca por motivo y no terminaron con error).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from call_audit import discrepancy_runs, golden_split
from call_audit.persistence.models import Case, DiscrepancyAnalysis, DiscrepancyPattern, PromptEvaluation, User

FAIL = "non_compliant"
PASS = "compliant"
UNSURE = "uncertain"


def empty() -> dict[str, int]:
    return dict.fromkeys(("n", "agree", "undecided", "promptFn", "promptFp", "reviewer", "reviewerFn", "reviewerFp"), 0)


def add(block: dict[str, int], kind: str, blue: bool) -> None:
    """kind: agree | undecided | fn | fp."""
    block["n"] += 1
    if kind in ("agree", "undecided"):
        block[kind] += 1
    elif blue:
        block["reviewer"] += 1
        block["reviewerFn" if kind == "fn" else "reviewerFp"] += 1
    else:
        block["promptFn" if kind == "fn" else "promptFp"] += 1


def blue_cases(patterns: list[DiscrepancyPattern]) -> set[tuple[int, str]]:
    """(motivo, llamada) que aparecen en algún patrón y en todos con causa "auditor" (D2, conservador)."""
    causes: dict[tuple[int, str], set[str]] = {}
    for p in patterns:
        cause = (p.data or {}).get("cause") or ("observation" if p.is_observation else "unknown")
        if p.is_observation:
            cause = "observation"
        for c in p.cases or []:
            causes.setdefault((p.criterion_id, str(c["callId"])), set()).add(cause)
    return {key for key, found in causes.items() if found == {"auditor"}}


def call_rows(
    results: list[dict], call_ids: dict[str, str], blue: set[tuple[int, str]], criteria: list[int]
) -> list[dict[str, Any]]:
    """Cada llamada medible con su parte del mosaico (`segment`) y la clase de cada motivo (agree | undecided | fn | fp,
    con `blue`). Es la base de `compute` y de la verificación caso a caso (04-verificacion-propuesta.md §4.1)."""
    rows = []
    for r in results:
        if r.get("externalFails") is None or r.get("error") or not r.get("external"):
            continue
        call = call_ids.get(r["caseId"], r["caseId"])
        ai_fails = set(r.get("failCriteria") or [])
        ai_unsure = set(r.get("uncertainCriteria") or [])
        ref_fails = {int(x) for x in r["externalFails"]}
        items = []
        for cid in criteria:
            if cid in ai_unsure:
                kind = "undecided"
            elif (cid in ai_fails) == (cid in ref_fails):
                kind = "agree"
            else:
                kind = "fn" if cid in ref_fails else "fp"
            items.append({"criterionId": cid, "kind": kind, "blue": kind in ("fn", "fp") and (cid, call) in blue})
        if r["verdict"] == UNSURE:
            segment = "undecided"
        elif r["verdict"] == r["external"]:
            segment = "agree"
        else:
            wrong = [i for i in items if i["kind"] in ("fn", "fp")]
            if wrong and all(i["blue"] for i in wrong):
                segment = "reviewer"
            else:
                segment = "promptFn" if r["external"] == FAIL else "promptFp"
        rows.append({"caseId": r["caseId"], "callId": call, "segment": segment, "items": items, "result": r})
    return rows


SEGMENT_KIND = {"agree": "agree", "undecided": "undecided", "promptFn": "fn", "promptFp": "fp"}


def compute_rows(rows: list[dict[str, Any]], criteria_count: int) -> dict[str, Any]:
    by_call, by_item = empty(), empty()
    for row in rows:
        for item in row["items"]:
            add(by_item, item["kind"], item["blue"])
        if row["segment"] == "reviewer":
            add(by_call, "fn" if row["result"]["external"] == FAIL else "fp", True)
        else:
            add(by_call, SEGMENT_KIND[row["segment"]], False)
    return {"byCall": by_call, "byCallCriterion": by_item, "criteria": criteria_count}


def compute(
    results: list[dict], call_ids: dict[str, str], blue: set[tuple[int, str]], criteria: list[int]
) -> dict[str, Any]:
    return compute_rows(call_rows(results, call_ids, blue, criteria), len(criteria))


def attribution_of(session: Session, evaluation: PromptEvaluation) -> DiscrepancyAnalysis | None:
    return session.scalar(
        select(DiscrepancyAnalysis)
        .where(
            DiscrepancyAnalysis.source_evaluation_id == evaluation.id,
            DiscrepancyAnalysis.purpose == "attribution",
        )
        .order_by(DiscrepancyAnalysis.created_at.desc())
    )


def cause_status(run: DiscrepancyAnalysis | None) -> str:
    if run is None:
        return "none"
    if run.status in ("queued", "running"):
        return "running"
    if run.status == "done":
        return "done"
    return "failed"


def for_results(
    session: Session, results: list[dict], run: DiscrepancyAnalysis | None, findings_stored: bool
) -> dict[str, Any] | None:
    if not results:
        return None
    ids = [r["caseId"] for r in results]
    call_ids = dict(session.execute(select(Case.id, Case.call_id).where(Case.id.in_(ids))).all())
    status = cause_status(run)
    patterns = (
        list(session.scalars(select(DiscrepancyPattern).where(DiscrepancyPattern.analysis_id == run.id)))
        if run is not None and status == "done"
        else []
    )
    out = compute(results, call_ids, blue_cases(patterns), golden_split.layer2_criteria())
    if not out["byCall"]["n"]:
        return None
    out["causeAnalysis"] = {
        "status": status,
        "costUsd": run.cost_usd if run is not None else None,
        "estimatedCostUsd": run.estimated_cost_usd if run is not None else None,
        "finishedAt": run.finished_at.isoformat() if run is not None and run.finished_at else None,
        "error": run.error if run is not None else None,
        "disagreements": out["byCall"]["promptFn"] + out["byCall"]["promptFp"] + out["byCall"]["reviewer"],
        # Las pruebas anteriores al loop no guardaron los hallazgos: no se les puede analizar la causa.
        "findingsStored": findings_stored,
    }
    return out


def for_evaluation(session: Session, evaluation: PromptEvaluation) -> dict[str, Any] | None:
    """El bloque `agreement` de las métricas de una prueba terminada, o None si no hay con qué calcularlo."""
    if evaluation.status != "done" or not evaluation.results:
        return None
    stored = all("findings" in r or r.get("error") for r in evaluation.results)
    return for_results(session, evaluation.results, attribution_of(session, evaluation), stored)


# --- Análisis de causa a pedido (E1) -----------------------------------------------------------------------------


def cause_criteria(session: Session, evaluation: PromptEvaluation) -> list[int]:
    rows, _, _ = discrepancy_runs.table(session, evaluation)
    return discrepancy_runs.criteria_with_disagreements(rows)


def cause_estimate(session: Session, evaluation: PromptEvaluation, model: str) -> dict[str, Any]:
    criteria = cause_criteria(session, evaluation)
    est = discrepancy_runs.estimate(session, criteria, model, evaluation) if criteria else {"totalUsd": 0.0}
    return {"model": model, "criteria": criteria, "totalUsd": est.get("totalUsd")}


def start_cause(session: Session, evaluation: PromptEvaluation, actor: User, model: str) -> DiscrepancyAnalysis:
    """Análisis de causa (purpose "attribution") de una prueba: solo pinta el azul; sus propuestas no van a la
    bandeja (R-11)."""
    if not all("findings" in r or r.get("error") for r in evaluation.results or []):
        raise ValueError("findings_missing")
    criteria = cause_criteria(session, evaluation)
    if not criteria:
        raise ValueError("no_disagreements")
    return discrepancy_runs.start(session, actor, criteria, model, source=evaluation, purpose="attribution")
