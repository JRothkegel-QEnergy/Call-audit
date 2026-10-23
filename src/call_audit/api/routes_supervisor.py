"""Vistas del supervisor: KPIs, alertas, aprobaciones, cuentas y el árbol de discrepancias con el cliente.

Lo que el front pide y todavía no tiene datos detrás (estadísticas por ejecutivo y por auditor, feedback,
exportación) responde 501: llega con el pipeline completo. Las invitaciones por correo llegaron con el Cambio 12.
"""

from collections import Counter
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from call_audit import accounts
from call_audit.api import serializers as out
from call_audit.api.deps import CurrentUser, DbSession, Supervisor, SupervisorOrAdmin
from call_audit.api.routes_auditor import REOPEN_PREFIX, RubricDep, get_case
from call_audit.config import Settings, get_settings
from call_audit.persistence.models import AccessLog, Alert, Case, DiscrepancyClassification, Note, Review, User

router = APIRouter(prefix="/api")


def not_yet() -> HTTPException:
    return HTTPException(501, "Disponible cuando el pipeline completo esté en producción")


def pct(part: int, total: int) -> float:
    return round(100 * part / total, 1) if total else 0.0


@router.get("/kpis")
def kpis(session: DbSession, _: Supervisor, rubric: RubricDep):
    cases = session.scalars(select(Case)).all()
    runs = [r for r in (out.current_run(c) for c in cases) if r]
    verdicts = Counter(r.verdict for r in runs)
    reviews = session.scalars(select(Review)).all()
    pending = [c for c in cases if c.status in ("pending", "reopened")]
    oldest = min((c.queued_at for c in pending), default=None)
    if oldest is not None and oldest.tzinfo is None:
        oldest = oldest.replace(tzinfo=UTC)
    by_day: dict[str, list[bool]] = {}
    for r in reviews:
        by_day.setdefault(r.submitted_at.date().isoformat(), []).append(r.final_verdict == "compliant")
    failed = Counter(f["criterionId"] for r in runs for f in r.findings if f["verdict"] == "non_compliant")
    critical = session.scalars(select(Alert).where(Alert.kind == "critical_confirmed")).all()
    return {
        "processed": len(cases),
        "engineCompliantPct": pct(verdicts["compliant"], len(runs)),
        "engineNonCompliantPct": pct(verdicts["non_compliant"], len(runs)),
        "engineUncertainPct": pct(verdicts["uncertain"], len(runs)),
        "finalCompliancePct": pct(sum(r.final_verdict == "compliant" for r in reviews), len(reviews)),
        "pendingCases": len(pending),
        "oldestPendingHours": round((datetime.now(UTC) - oldest).total_seconds() / 3600, 1) if oldest else 0,
        "criticalConfirmed": len(critical),
        "criticalUnhandled": sum(a.status != "handled" for a in critical),
        "dailyCompliance": [{"date": d, "pct": pct(sum(v), len(v))} for d, v in sorted(by_day.items())],
        "topCriteria": [{"criterionId": c, "pct": pct(n, len(runs))} for c, n in failed.most_common(5)],
    }


@router.get("/criteria/stats")
def criterion_stats(session: DbSession, _: Supervisor):
    """Incumplimientos confirmados por un auditor (la pantalla "Motivos" solo cuenta lo revisado por personas)."""
    reviews = session.scalars(select(Review)).all()
    failed = Counter(i["criterionId"] for r in reviews for i in r.items if i["verdict"] == "non_compliant")
    return [{"criterionId": c, "count": n, "pct": pct(n, len(reviews)), "deltaPts": 0} for c, n in failed.most_common()]


# --- Alertas y aprobaciones -------------------------------------------------------------


@router.get("/alerts")
def list_alerts(session: DbSession, _: Supervisor, status: str | None = None):
    query = select(Alert).order_by(Alert.created_at.desc())
    if status:
        query = query.where(Alert.status == status)
    return [
        {
            "id": a.id,
            "kind": a.kind,
            "status": a.status,
            "caseId": a.case_id,
            "callId": a.case.call_id,
            "criterionId": a.criterion_id,
            "atMs": a.at_ms,
            "reason": a.reason,
            "comment": a.comment,
            "raisedBy": a.raised_by.name,
            "createdAt": out.iso(a.created_at),
            **({"handledComment": a.handled_comment} if a.handled_comment else {}),
        }
        for a in session.scalars(query)
    ]


class HandleIn(BaseModel):
    comment: str | None = None


@router.post("/alerts/{alert_id}/handle", status_code=204)
def handle_alert(alert_id: str, body: HandleIn, session: DbSession, _: Supervisor) -> None:
    alert = session.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(404, "Alerta no encontrada")
    alert.status, alert.handled_comment = "handled", body.comment
    session.commit()


@router.get("/approvals")
def pending_approvals(session: DbSession, _: Supervisor):
    rows = []
    for case in session.scalars(select(Case).where(Case.status == "awaiting_approval")):
        review = session.scalar(select(Review).where(Review.case_id == case.id))
        if review is None:
            continue
        flags = []
        if any(i["action"] in ("corrected", "added") for i in review.items):
            flags.append("corrected_ai")
        # Revisión más corta que la mitad del audio: puede que no lo haya escuchado.
        if review.review_seconds and review.review_seconds < case.duration_ms / 2000:
            flags.append("fast_review")
        rows.append(
            {
                "caseId": case.id,
                "callId": case.call_id,
                "auditorId": review.auditor_id,
                "auditorName": review.auditor.name,
                "submittedAt": out.iso(review.submitted_at),
                "finalVerdict": review.final_verdict,
                "reviewSeconds": review.review_seconds,
                "flags": flags,
                "correctionReasons": sorted({i["correctionReason"] for i in review.items if i.get("correctionReason")}),
            }
        )
    return rows


class CaseIdsIn(BaseModel):
    caseIds: list[str]  # noqa: N815
    batch: bool = False


@router.post("/approvals", status_code=204)
def approve(body: CaseIdsIn, session: DbSession, _: Supervisor) -> None:
    for case_id in body.caseIds:
        case = get_case(session, case_id)
        if case.status == "awaiting_approval":
            case.status = "closed"
            review = session.scalar(select(Review).where(Review.case_id == case.id))
            if review:
                review.approved_at = datetime.now(UTC)
    session.commit()


@router.post("/approvals/undo", status_code=204)
def undo_approvals(body: CaseIdsIn, session: DbSession, _: Supervisor) -> None:
    for case_id in body.caseIds:
        case = get_case(session, case_id)
        if case.status == "closed":
            case.status = "awaiting_approval"
            review = session.scalar(select(Review).where(Review.case_id == case.id))
            if review:
                review.approved_at = None
    session.commit()


class ReopenIn(BaseModel):
    auditorId: str  # noqa: N815
    comment: str


@router.post("/cases/{case_id}/reopen", status_code=204)
def reopen(case_id: str, body: ReopenIn, session: DbSession, user: Supervisor) -> None:
    case = get_case(session, case_id)
    case.status, case.assigned_auditor_id, case.locked_by_id = "reopened", body.auditorId, None
    session.add(Note(case_id=case.id, scope="case", text=f"{REOPEN_PREFIX}{body.comment}", author_id=user.id))
    session.commit()


# --- Cuentas ----------------------------------------------------------------------------


@router.get("/auditors/accounts")
def auditor_accounts(session: DbSession, _: Supervisor):
    users = session.scalars(select(User).where(User.role == "auditor").order_by(User.name))
    return [
        {"id": u.id, "name": u.name, "email": u.email, "status": u.status, "loginMethod": "password"} for u in users
    ]


@router.get("/auditors/active")
def active_auditors(session: DbSession, _: Supervisor):
    users = session.scalars(select(User).where(User.role == "auditor", User.status == "active").order_by(User.name))
    return [{"id": u.id, "name": u.name} for u in users]


class StatusIn(BaseModel):
    status: Literal["active", "deactivated"]


@router.post("/auditors/accounts/{account_id}/status", status_code=204)
def set_account_status(account_id: str, body: StatusIn, session: DbSession, _: Supervisor) -> None:
    user = session.get(User, account_id)
    if user is None or user.role != "auditor":
        raise HTTPException(404, "Cuenta no encontrada")
    user.status = body.status
    session.commit()


class InviteAuditorIn(BaseModel):
    name: str
    email: str


@router.post("/auditors/invite", status_code=204)
def invite_auditor(
    body: InviteAuditorIn, session: DbSession, user: Supervisor, settings: Annotated[Settings, Depends(get_settings)]
) -> None:
    """El supervisor invita auditores por correo; solo Qubico crea supervisores (D-12)."""
    if not body.name.strip() or "@" not in body.email:
        raise HTTPException(422, "invalid")
    try:
        accounts.invite(
            session, inviter=user, name=body.name, email=body.email, role="auditor", permissions=[], settings=settings
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    session.commit()


@router.post("/auditors/accounts/{account_id}/resend", status_code=204)
def resend_auditor_invite(
    account_id: str, session: DbSession, user: Supervisor, settings: Annotated[Settings, Depends(get_settings)]
) -> None:
    target = session.get(User, account_id)
    if target is None or target.role != "auditor" or target.status != "invited":
        raise HTTPException(404, "Cuenta no encontrada")
    accounts.send_invitation(session, target, user, settings)
    accounts.log(session, user, "invite_resent", target.email)
    session.commit()


# --- Discrepancias con el cliente (Cambio 09 §4) ----------------------------------------


def branch(ai: str, client: str) -> str:
    if ai == "uncertain":
        return "ai_uncertain"
    if ai == client:
        return "match"
    return "ai_only_fail" if ai == "non_compliant" else "ai_missed_fail"


@router.get("/discrepancies")
def discrepancies(session: DbSession, _: SupervisorOrAdmin):
    rows = []
    for case in session.scalars(select(Case).where(Case.external_verdict.is_not(None))):
        run = out.current_run(case)
        if run is None:
            continue
        review = session.scalar(select(Review).where(Review.case_id == case.id))
        item = session.get(DiscrepancyClassification, case.id)
        notes = session.scalars(select(Note.id).where(Note.case_id == case.id)).all()
        rows.append(
            {
                "caseId": case.id,
                "callId": case.call_id,
                "callDate": case.call_date,
                "agentName": out.agent_name(case.agent.name),
                "aiVerdict": run.verdict,
                "clientVerdict": case.external_verdict,
                "appAuditorVerdict": review.final_verdict if review else None,
                "branch": branch(run.verdict, case.external_verdict),
                "aiFailCriteria": sorted(f["criterionId"] for f in run.findings if f["verdict"] == "non_compliant"),
                "classification": item.classification if item else None,
                "classifiedCriteria": item.criterion_ids if item else [],
                "presentation": item.presentation if item else None,
                "notesCount": len(notes) + (1 if item and item.note else 0),
            }
        )
    return rows


class ClassifyIn(BaseModel):
    classification: Literal["ai_correct", "ai_wrong"] | None
    criterionIds: list[int] = []  # noqa: N815
    note: str | None = None


def classification_for(session: DbSession, case_id: str, user: User) -> DiscrepancyClassification:
    item = session.get(DiscrepancyClassification, case_id)
    if item is None:
        item = DiscrepancyClassification(case_id=case_id, updated_by_id=user.id)
        session.add(item)
    item.updated_by_id, item.updated_at = user.id, datetime.now(UTC)
    return item


@router.post("/discrepancies/{case_id}", status_code=204)
def classify(case_id: str, body: ClassifyIn, session: DbSession, user: SupervisorOrAdmin) -> None:
    get_case(session, case_id)
    item = classification_for(session, case_id, user)
    item.classification, item.criterion_ids = body.classification, body.criterionIds
    if body.note is not None:
        item.note = body.note
    # Los aciertos de la IA se presentan uno por uno a la contraparte.
    if body.classification == "ai_correct" and item.presentation is None:
        item.presentation = "pending"
    if body.classification != "ai_correct":
        item.presentation = None
    session.commit()


class PresentationIn(BaseModel):
    presented: bool


@router.post("/discrepancies/{case_id}/presentation", status_code=204)
def set_presentation(case_id: str, body: PresentationIn, session: DbSession, user: SupervisorOrAdmin) -> None:
    get_case(session, case_id)
    item = session.get(DiscrepancyClassification, case_id)
    if item is None or item.classification != "ai_correct":
        raise HTTPException(409, "Solo se presentan los casos donde la IA acertó")
    item.updated_by_id, item.updated_at = user.id, datetime.now(UTC)
    item.presentation = "presented" if body.presented else "pending"
    session.commit()


# --- Registro de accesos y lo que aún no existe -----------------------------------------


@router.post("/access-log/agent-search/{agent_id}", status_code=204)
def log_agent_search(agent_id: str, session: DbSession, user: CurrentUser) -> None:
    session.add(AccessLog(user_id=user.id, action="agent_search", target=agent_id))
    session.commit()


# Estadísticas que v0 todavía no calcula: listas vacías, para que el front muestre su estado "no disponible"
# (Cambio 10 de UX). Las acciones que fallarían al enviar se ocultan en el front y aquí responden 501.
@router.get("/agents/stats")
@router.get("/auditors/stats")
def empty_stats(_: Supervisor) -> list:
    return []


@router.get("/criteria/heatmap")
def empty_heatmap(_: Supervisor) -> dict:
    return {"agents": [], "rows": []}


@router.get("/agents/{agent_id}/detail")
def agent_detail(agent_id: str, _: Supervisor):
    raise HTTPException(404, "Detalle por ejecutivo disponible en una próxima versión")


@router.post("/cases/{case_id}/override")
@router.post("/feedback")
@router.post("/export")
def not_implemented(_: Supervisor):
    raise not_yet()
