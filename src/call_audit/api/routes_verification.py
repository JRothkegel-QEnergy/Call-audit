"""Verificación con verificadores (docs/ux/admin-prompt-metrics/13-rol-verificador-asignacion.md).

Corrida completa de una versión (todas las llamadas con planilla), reparto de llamadas entre verificadores, avance y
la marca «Sin observaciones». Sin IA, salvo la corrida completa, que se encola y la corre el worker.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from call_audit import assignments, prompt_evaluation, verification
from call_audit.api.deps import Admin, AdminReader, DbSession, VerificationReader
from call_audit.api.routes_admin import get_prompt, verification_target
from call_audit.persistence.models import PromptEvaluation

router = APIRouter(prefix="/api")


def public_plan(plan: dict) -> dict:
    return {k: v for k, v in plan.items() if not k.startswith("_")}


# --- Corrida completa ----------------------------------------------------------------------------------------------


def full_out(ev: PromptEvaluation | None) -> dict | None:
    if ev is None:
        return None
    return {
        "id": ev.id,
        "status": ev.status,
        "model": ev.model,
        "done": ev.done,
        "n": len(ev.case_ids or []),
        "estimatedCostUsd": ev.estimated_cost_usd,
        "costUsd": ev.cost_usd,
        "errors": sum(1 for r in ev.results or [] if r.get("error")),
        "createdAt": ev.created_at.isoformat() if ev.created_at else None,
        "finishedAt": ev.finished_at.isoformat() if ev.finished_at else None,
    }


@router.get("/admin/prompts/{version}/full-run")
def full_run_status(version: str, session: DbSession, _: AdminReader):
    """La última corrida completa de la versión (en curso o terminada) y lo que costaría correr lo que falta."""
    get_prompt(session, version)
    ev = session.scalar(
        select(PromptEvaluation)
        .where(PromptEvaluation.version == version, PromptEvaluation.purpose == "full")
        .order_by(PromptEvaluation.created_at.desc())
    )
    return {"run": full_out(ev), "estimate": public_plan(prompt_evaluation.full_plan(session, version))}


@router.post("/admin/prompts/{version}/full-run")
def start_full_run(version: str, session: DbSession, user: Admin):
    """Encola la corrida completa (pagada: solo las llamadas sin resultado de la versión)."""
    try:
        ev = prompt_evaluation.start_full(session, version, user)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    session.commit()
    return full_out(ev)


# --- Pantalla de verificación --------------------------------------------------------------------------------------


@router.get("/verification")
def verification_home(session: DbSession, user: VerificationReader):
    """Dónde entra el verificador (V2 A): la versión con la última corrida completa terminada."""
    ev = prompt_evaluation.latest_full(session)
    if ev is None:
        return {"version": None}
    # El contador del menú y de la bandeja (18, W1 A): solo para el verificador.
    me = assignments.my_summary(session, ev, user) if user.role == assignments.VERIFIER else None
    return {"version": ev.version, "evaluationId": ev.id, "me": me}


@router.get("/admin/prompts/{version}/verification")
def verification_overview(version: str, session: DbSession, user: VerificationReader, assignee: str | None = None):
    """Mosaico y cifras de la corrida completa, filtrados por «Asignadas a» (V3 A), con la tarjeta del verificador."""
    ev = verification_target(session, version, "full", user)
    ids = assignments.scope_ids(session, ev, user, assignee)
    block = verification.with_summaries(session, assignments.scoped(ev, ids))
    # Avance del alcance para el gráfico del Resumen (19, X1-X2 A): las sin asignar cuentan como por revisar.
    items = [it for it in assignments.all_items(session, ev) if ids is None or it["caseId"] in ids]
    found = assignments.assignment_map(session, [it["caseId"] for it in items])
    reviewed = sum(1 for it in items if assignments.is_reviewed(it, found.get(it["caseId"])))
    return {
        "version": ev.version,
        "evaluationId": ev.id,
        "model": ev.model,
        "assignee": assignee or ("me" if user.role == assignments.VERIFIER else "all"),
        "n": len(ids) if ids is not None else len(ev.results or []),
        "agreement": block,
        "progress": {"total": len(items), "reviewed": reviewed, "pending": len(items) - reviewed},
        # Cumple / No cumple según Qubyt por criterio, en las mismas llamadas del avance (22, AA1-AA4).
        "criteria": verification.criteria_stats(ev, {it["caseId"] for it in items}),
        "me": assignments.my_summary(session, ev, user) if user.role == assignments.VERIFIER else None,
        "verifiers": [{"id": u.id, "name": u.name} for u in assignments.verifiers(session)]
        if user.role != assignments.VERIFIER
        else [],
    }


@router.get("/admin/prompts/{version}/verification/progress")
def verification_progress(version: str, session: DbSession, user: AdminReader):
    """Avance por verificador (V6 A)."""
    return assignments.progress(session, verification_target(session, version, "full", user))


class DistributeIn(BaseModel):
    userIds: list[str]  # noqa: N815


@router.post("/admin/prompts/{version}/verification/distribute/preview")
def distribute_preview(version: str, body: DistributeIn, session: DbSession, user: Admin):
    try:
        plan = assignments.plan(session, verification_target(session, version, "full", user), body.userIds)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return public_plan(plan)


@router.post("/admin/prompts/{version}/verification/distribute")
def distribute(version: str, body: DistributeIn, session: DbSession, user: Admin):
    """Reparte lo sin asignar y pendiente (V5 A). Lo ya asignado no se mueve."""
    try:
        plan = assignments.distribute(session, verification_target(session, version, "full", user), body.userIds, user)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    session.commit()
    return public_plan(plan)


class MoveIn(BaseModel):
    fromUserId: str  # noqa: N815
    toUserIds: list[str]  # noqa: N815


@router.post("/admin/prompts/{version}/verification/move")
def move_pending(version: str, body: MoveIn, session: DbSession, user: Admin):
    """«Pasar pendientes a…»: lo revisado no cambia de dueño."""
    try:
        moved = assignments.move_pending(
            session, verification_target(session, version, "full", user), body.fromUserId, body.toUserIds, user
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    session.commit()
    return {"moved": moved}


class AssigneeIn(BaseModel):
    userId: str | None = None  # noqa: N815


@router.put("/admin/assignments/{case_id}", status_code=204)
def set_assignee(case_id: str, body: AssigneeIn, session: DbSession, user: Admin) -> None:
    try:
        assignments.set_assignee(session, case_id, body.userId, user)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    session.commit()


class ReviewedIn(BaseModel):
    reviewed: bool


@router.put("/admin/assignments/{case_id}/reviewed")
def set_reviewed(case_id: str, body: ReviewedIn, session: DbSession, user: VerificationReader):
    """«Sin observaciones» / «Deshacer» en una llamada sin desacuerdos (13, V1 B)."""
    if not assignments.can_record(session, user, case_id):
        raise HTTPException(403, "not_assigned")
    try:
        row = assignments.mark_reviewed(session, case_id, user, body.reviewed)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    session.commit()
    return assignments.assignment_out(row, user)
