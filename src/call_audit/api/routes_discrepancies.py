"""Análisis de discrepancias del admin Qubico (Cambio 16). Todo solo `qubico_admin`."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from call_audit import accounts, discrepancy_insights, discrepancy_runs, verification
from call_audit.api.deps import Admin, AdminReader, DbSession
from call_audit.persistence.models import DiscrepancyAnalysis, DiscrepancyPattern, PromptEvaluation

router = APIRouter(prefix="/api/admin/discrepancies")


def get_pattern(session: DbSession, pattern_id: str) -> DiscrepancyPattern:
    pattern = session.get(DiscrepancyPattern, pattern_id)
    if pattern is None:
        raise HTTPException(404, "not_found")
    return pattern


@router.get("")
def overview(session: DbSession, _: AdminReader, analysis: str | None = None):
    try:
        out = discrepancy_runs.overview(session, analysis)
    except LookupError as exc:
        raise HTTPException(404, "not_found") from exc
    # Cifras del Resumen según el análisis elegido (06-ajustes-feedback.md §4.1, F3).
    shown = session.get(DiscrepancyAnalysis, out["analysis"]["id"]) if out["analysis"] else None
    if out["analysis"] and shown is not None and shown.source_evaluation_id:
        source = session.get(PromptEvaluation, shown.source_evaluation_id)
        out["analysis"]["sourceVersion"] = source.version if source else None
        out["analysis"]["sourceSplit"] = source.split if source else None
    quality = verification.quality_for_analysis(session, shown)
    if quality and quality.get("evaluationId"):
        ev = session.get(PromptEvaluation, quality["evaluationId"])
        quality["insights"] = discrepancy_insights.insights(session, ev) if ev is not None else None
        # Fuente única (10-resumen-mas-informacion.md §3, R1 A): si el análisis es de esta misma prueba, Patrones cuenta
        # los mismos desacuerdos que el Resumen (sin el motivo 1 de capa 1 ni la duda de la IA).
        ins = quality["insights"]
        if ins and shown is not None and shown.source_evaluation_id == ev.id:
            by_action = {k: ins["byAction"].get(k, 0) for k in out["summary"]["byAction"]}
            unexplained = by_action.get("unpatterned", 0) + by_action.get("observation", 0)
            out["summary"] = {
                **out["summary"],
                "disagreements": ins["disagreements"],
                "analyzedCases": ins["disagreements"],
                "explainedCases": ins["disagreements"] - unexplained,
                "byAction": by_action,
                "layer1Cases": sum(c["fp"] + c["fn"] for c in out["criteria"] if c["criterionId"] == 1),
                "sameSource": True,
            }
    return {**out, "quality": quality}


class AnalysisIn(BaseModel):
    criteria: list[int]
    model: str
    confirm: bool = False


@router.post("/estimate")
def estimate(body: AnalysisIn, session: DbSession, _: Admin):
    if body.model not in {m["name"] for m in discrepancy_runs.model_options()}:
        raise HTTPException(422, "unknown_model")
    return discrepancy_runs.estimate(session, sorted(set(body.criteria)), body.model)


@router.post("/analyses")
def start(body: AnalysisIn, session: DbSession, user: Admin):
    if not body.confirm:
        raise HTTPException(422, "confirm_required")
    try:
        run = discrepancy_runs.start(session, user, body.criteria, body.model)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    accounts.log(
        session,
        user,
        "discrepancy_analysis_started",
        "Análisis de discrepancias",
        f"{len(run.criteria)} motivos · {run.model} · estimado {run.estimated_cost_usd or 0:.2f} USD",
    )
    session.commit()
    return discrepancy_runs.analysis_out(run)


@router.post("/analyses/{analysis_id}/stop", status_code=204)
def stop(analysis_id: str, session: DbSession, user: Admin) -> None:
    run = session.get(DiscrepancyAnalysis, analysis_id)
    if run is None:
        raise HTTPException(404, "not_found")
    try:
        discrepancy_runs.stop(session, run, user)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    accounts.log(
        session,
        user,
        "discrepancy_analysis_stopped",
        "Análisis de discrepancias",
        f"{len(run.done_criteria)} de {len(run.criteria)} motivos · {run.cost_usd:.2f} USD gastados",
    )
    session.commit()


@router.get("/analyses")
def analyses(session: DbSession, _: AdminReader):
    return discrepancy_runs.list_analyses(session)


@router.get("/patterns/{pattern_id}")
def pattern(pattern_id: str, session: DbSession, _: AdminReader):
    try:
        return discrepancy_runs.pattern_detail(session, pattern_id)
    except LookupError as exc:
        raise HTTPException(404, "not_found") from exc


class DecisionIn(BaseModel):
    decision: Literal["accepted", "discarded", "pending"]
    text: str | None = None
    reason: str | None = None
    note: str | None = None


ACTIONS = {"accepted": "proposal_accepted", "discarded": "proposal_discarded", "pending": "proposal_reopened"}


@router.post("/patterns/{pattern_id}/decision")
def decide(pattern_id: str, body: DecisionIn, session: DbSession, user: Admin):
    pattern = get_pattern(session, pattern_id)
    try:
        row = discrepancy_runs.decide(session, pattern, user, body.decision, body.text, body.reason, body.note)
    except ValueError as exc:
        raise HTTPException(422 if str(exc) == "reason_required" else 409, str(exc)) from exc
    title = (pattern.data or {}).get("title", "")
    details = (body.reason or "") if body.decision == "discarded" else title
    accounts.log(session, user, ACTIONS[body.decision], f"Motivo {pattern.criterion_id} · patrón", details[:500])
    session.commit()
    return discrepancy_runs.pattern_out(session, pattern, row)


class DiscardObservationsIn(BaseModel):
    ids: list[str]
    reason: str


@router.post("/observations/discard")
def discard_observations(body: DiscardObservationsIn, session: DbSession, user: Admin):
    try:
        rows, changed = discrepancy_runs.discard_observations(session, body.ids, user, body.reason)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    accounts.log(
        session,
        user,
        "observations_discarded",
        f"Motivo {rows[0][0].criterion_id} · observaciones",
        f"{changed} observaciones · {body.reason.strip()}"[:500],
    )
    session.commit()
    return [discrepancy_runs.pattern_out(session, p, d) for p, d in rows]


class FollowUpIn(BaseModel):
    status: Literal["asked_client", "calibrated", "accepted"]


@router.post("/patterns/{pattern_id}/follow-up")
def follow_up(pattern_id: str, body: FollowUpIn, session: DbSession, user: Admin):
    pattern = get_pattern(session, pattern_id)
    try:
        row = discrepancy_runs.set_follow_up(session, pattern, user, body.status)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    accounts.log(session, user, f"proposal_{body.status}", f"Motivo {pattern.criterion_id} · patrón")
    session.commit()
    return discrepancy_runs.pattern_out(session, pattern, row)


@router.get("/follow-up")
def follow_up_list(session: DbSession, _: AdminReader):
    return discrepancy_runs.follow_up(session)
