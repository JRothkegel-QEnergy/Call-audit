"""Administrador Qubico (Cambio 12): cuentas, versiones del prompt, estadísticas del sistema y registro de actividad.
Procesamiento (Cambio 14): estado del worker, avance de la pasada en curso y fallas de transcripción.
También las rutas públicas de invitación y restablecimiento de contraseña (/api/auth/invite, /api/auth/forgot).

Sin métricas por persona (L-06, L-22, L-31). Los errores que el front distingue van como código en `detail`.
"""

from collections import Counter, defaultdict
from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from statistics import mean
from typing import Annotated, Any, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, object_session

from call_audit import (
    accounts,
    agreement,
    assignments,
    discrepancy_runs,
    golden_split,
    prompt_evaluation,
    prompt_followup,
    prompt_loop,
    prompt_registry,
    verification,
)
from call_audit.api import serializers as out
from call_audit.api.deps import Admin, AdminReader, CurrentUser, DbSession, VerificationReader, set_session
from call_audit.config import Settings, get_settings
from call_audit.persistence.models import (
    AccessLog,
    AsrFailure,
    Case,
    CatalogUpload,
    ModelRun,
    PipelineRun,
    PromptEvaluation,
    PromptVersion,
    Review,
    User,
    WorkerHeartbeat,
)
from call_audit.prompt_registry import PromptError
from call_audit.rubric import load_rubric

router = APIRouter(prefix="/api")
SettingsDep = Annotated[Settings, Depends(get_settings)]
Role = Literal["auditor", "supervisor", "qubico_admin", "qubico_viewer", "qubico_verifier"]
PERMISSIONS = {
    "auditor": {"view_model_io"},
    "supervisor": {"manage_catalog"},
    "qubico_admin": set(),
    "qubico_viewer": set(),
    "qubico_verifier": set(),
}
OPEN_STATUSES = ("pending", "in_review", "reopened")


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


# --- Invitaciones (públicas) -------------------------------------------------------------------------------------


@router.get("/auth/invite/{token}")
def invite_info(token: str, session: DbSession):
    user = accounts.find_by_token(session, token)
    state = accounts.link_state(user)
    if user is None:
        return {"state": state}
    return {
        "state": state,
        "kind": user.invite_kind,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "invitedBy": user.created_by.name if user.created_by else None,
        "expiresAt": iso(accounts.aware(user.invite_expires_at)),
    }


class AcceptIn(BaseModel):
    password: str
    acceptTerms: bool = False


@router.post("/auth/invite/{token}")
def accept_invite(token: str, body: AcceptIn, response: Response, session: DbSession, settings: SettingsDep):
    user = accounts.find_by_token(session, token)
    if user is not None and user.invite_kind == "invite" and not body.acceptTerms:
        raise HTTPException(422, "terms_required")
    try:
        user = accounts.accept(session, token, body.password)
    except ValueError as exc:
        raise HTTPException(422 if str(exc) == "short_password" else 410, str(exc)) from exc
    user.last_login_at = datetime.now(UTC)
    session.commit()
    set_session(response, user, settings)
    return out.user_out(user)


class ForgotIn(BaseModel):
    email: str


@router.post("/auth/forgot", status_code=204)
def forgot_password(body: ForgotIn, session: DbSession, settings: SettingsDep) -> None:
    """Siempre 204: no revela si el correo tiene cuenta."""
    user = session.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is not None and user.status == "active":
        accounts.send_reset(session, user, settings)
        session.commit()


# --- Cuentas ------------------------------------------------------------------------------------------------------


def account_out(user: User) -> dict:
    status = user.status
    if status == "invited" and accounts.link_state(user) == "expired":
        status = "invite_expired"
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "status": status,
        "loginMethod": "password",
        "permissions": user.permissions or [],
        "lastLoginAt": iso(user.last_login_at),
        "createdBy": user.created_by.name if user.created_by else "Script inicial",
        "createdAt": iso(user.created_at),
    }


@router.get("/admin/accounts")
def list_accounts(session: DbSession, _: Admin):
    return [account_out(u) for u in session.scalars(select(User).order_by(User.role, User.name))]


class InviteIn(BaseModel):
    name: str
    email: str
    role: Role
    permissions: list[str] = []


def clean_permissions(role: str, permissions: list[str]) -> list[str]:
    allowed = PERMISSIONS[role]
    bad = set(permissions) - allowed
    if bad:
        raise HTTPException(422, "invalid_permission")
    return sorted(set(permissions))


@router.post("/admin/accounts/invite", status_code=204)
def invite_user(body: InviteIn, session: DbSession, user: Admin, settings: SettingsDep) -> None:
    if not body.name.strip() or "@" not in body.email:
        raise HTTPException(422, "invalid")
    try:
        accounts.invite(
            session,
            inviter=user,
            name=body.name,
            email=body.email,
            role=body.role,
            permissions=clean_permissions(body.role, body.permissions),
            settings=settings,
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    session.commit()


def get_account(session: Session, account_id: str) -> User:
    target = session.get(User, account_id)
    if target is None:
        raise HTTPException(404, "not_found")
    return target


class StatusIn(BaseModel):
    status: Literal["active", "deactivated"]


@router.post("/admin/accounts/{account_id}/status", status_code=204)
def set_status(account_id: str, body: StatusIn, session: DbSession, user: Admin) -> None:
    target = get_account(session, account_id)
    if target.id == user.id:
        raise HTTPException(409, "self")
    if target.role == "qubico_admin" and body.status == "deactivated":
        admins = session.scalar(
            select(func.count()).select_from(User).where(User.role == "qubico_admin", User.status == "active")
        )
        if (admins or 0) <= 1 and target.status == "active":
            raise HTTPException(409, "last_admin")
    if body.status == "active" and target.password_hash is None:
        raise HTTPException(409, "never_activated")
    target.status = body.status
    accounts.log(
        session, user, "account_reactivated" if body.status == "active" else "account_deactivated", target.email
    )
    session.commit()


class PermissionsIn(BaseModel):
    permissions: list[str]


@router.post("/admin/accounts/{account_id}/permissions", status_code=204)
def set_permissions(account_id: str, body: PermissionsIn, session: DbSession, user: Admin) -> None:
    target = get_account(session, account_id)
    target.permissions = clean_permissions(target.role, body.permissions)
    accounts.log(session, user, "permission_changed", target.email, ", ".join(target.permissions) or "sin permisos")
    session.commit()


@router.post("/admin/accounts/{account_id}/resend", status_code=204)
def resend_invite(account_id: str, session: DbSession, user: Admin, settings: SettingsDep) -> None:
    target = get_account(session, account_id)
    if target.status != "invited":
        raise HTTPException(409, "not_invited")
    accounts.send_invitation(session, target, user, settings)
    accounts.log(session, user, "invite_resent", target.email)
    session.commit()


@router.post("/admin/accounts/{account_id}/reset-password", status_code=204)
def reset_password(account_id: str, session: DbSession, user: Admin, settings: SettingsDep) -> None:
    target = get_account(session, account_id)
    if target.status != "active":
        raise HTTPException(409, "not_active")
    accounts.send_reset(session, target, settings)
    accounts.log(session, user, "password_reset_sent", target.email)
    session.commit()


# --- Versiones del prompt -----------------------------------------------------------------------------------------


def prompt_out(row: PromptVersion) -> dict:
    return {
        "version": row.version,
        "status": row.status,
        "source": row.source,
        "model": row.model,
        "changelog": row.changelog,
        "rationale": row.rationale,
        "createdBy": row.created_by.name if row.created_by else ("Repo" if row.source == "repo" else "Bench"),
        "createdAt": iso(row.created_at),
        "testedAt": iso(row.tested_at),
        "activatedBy": row.activated_by.name if row.activated_by else None,
        "activatedAt": iso(row.activated_at),
        "activationReason": row.activation_reason,
        "retiredAt": iso(row.retired_at),
    }


def evaluation_out(evaluation: PromptEvaluation | None) -> dict | None:
    if evaluation is None:
        return None
    return {
        "id": evaluation.id,
        "status": evaluation.status,
        "model": evaluation.model,
        "total": len(evaluation.case_ids),
        "done": evaluation.done,
        "estimatedCostUsd": evaluation.estimated_cost_usd,
        "costUsd": evaluation.cost_usd,
        "requestedBy": evaluation.requested_by.name if evaluation.requested_by else None,
        "stoppedBy": evaluation.stopped_by.name if evaluation.stopped_by else None,
        "startedAt": iso(evaluation.started_at),
        "finishedAt": iso(evaluation.finished_at),
        "error": evaluation.error,
        "metrics": evaluation_metrics(evaluation),
    }


def evaluation_metrics(evaluation: PromptEvaluation) -> dict | None:
    """Métricas guardadas, con las de la planilla por motivo recalculadas desde los resultados (sin gastar), para
    que las pruebas antiguas también muestren FP/FN con sus conteos."""
    if not evaluation.metrics:
        return evaluation.metrics
    return {
        **evaluation.metrics,
        "criterionScores": prompt_evaluation.criterion_scores(evaluation.results or []),
        "agreement": with_verification(object_session(evaluation), evaluation),
    }


def with_verification(session: Session, evaluation: PromptEvaluation) -> dict | None:
    """El mosaico con la suma de lo verificado a mano en cada parte (04-verificacion-propuesta.md §6.1) y cuántas de sus
    reglas salen de las mismas llamadas de validación (aviso N8 A)."""
    block = verification.with_summaries(session, evaluation)
    if block is not None:
        block["sameCallRules"] = verification.same_call_rules(session, evaluation.version)
    return block


def get_prompt(session: Session, version: str) -> PromptVersion:
    row = session.get(PromptVersion, version)
    if row is None:
        raise HTTPException(404, "not_found")
    return row


def bad_prompt(exc: PromptError) -> HTTPException:
    return HTTPException(422, {"code": "invalid_prompt", "errors": exc.errors})


@router.get("/admin/models")
def list_models(_: AdminReader):
    return [{"name": m["name"], "provider": m["provider"]} for m in prompt_evaluation.models()]


@router.get("/prompts/active")
def active_prompt(session: DbSession, _: CurrentUser):
    """Para el aviso a supervisores "Desde el {fecha} se usa el prompt v{x}"."""
    row = prompt_registry.ensure_bootstrap(session)
    session.commit()
    return {"version": row.version, "since": iso(row.activated_at), "changedInApp": row.activated_by_id is not None}


@router.get("/admin/prompts")
def list_prompts(session: DbSession, _: AdminReader):
    prompt_registry.ensure_bootstrap(session)
    session.commit()
    rows = sorted(
        session.scalars(select(PromptVersion)), key=lambda r: prompt_registry.version_key(r.version), reverse=True
    )
    result = []
    for row in rows:
        evaluation = prompt_evaluation.latest(session, row.version)
        result.append(prompt_out(row) | {"evaluation": evaluation_out(evaluation)})
    return result


class PromptIn(BaseModel):
    source: Literal["yaml", "text"]
    content: str
    version: str | None = None
    model: str
    changelog: str
    rationale: str | None = None


@router.post("/admin/prompts")
def create_prompt(body: PromptIn, session: DbSession, user: Admin):
    if body.model not in {m["name"] for m in prompt_evaluation.models()}:
        raise HTTPException(422, "unknown_model")
    try:
        row = prompt_registry.create_draft(
            session,
            author=user,
            source=body.source,
            content=body.content,
            version=body.version,
            model=body.model,
            changelog=body.changelog,
            rationale=body.rationale,
        )
    except PromptError as exc:
        raise bad_prompt(exc) from exc
    accounts.log(session, user, "prompt_published", f"Prompt v{row.version}", body.changelog.strip()[:500])
    session.commit()
    return prompt_out(row)


# Versión desde Seguimiento (Cambio 18): las reglas aceptadas se aplican sin IA al criterio de su motivo.
class FollowUpPreviewIn(BaseModel):
    proposalIds: list[str]
    # Texto final editado a mano, por motivo.
    overrides: dict[int, str] = {}


def follow_up_error(exc: prompt_followup.FollowUpError) -> HTTPException:
    status = 422 if exc.code in ("no_rules", "review_pending") else 409
    return HTTPException(status, {"code": exc.code, "errors": exc.errors})


@router.post("/admin/prompts/from-follow-up/preview")
def preview_prompt_from_follow_up(body: FollowUpPreviewIn, session: DbSession, _: Admin):
    """La comparación por motivo. No guarda nada ni gasta."""
    try:
        result = prompt_followup.preview(session, body.proposalIds, body.overrides)
    except prompt_followup.FollowUpError as exc:
        raise follow_up_error(exc) from exc
    session.commit()  # ensure_bootstrap puede registrar la vigente del repo
    return result


class FollowUpCreateIn(FollowUpPreviewIn):
    baseVersion: str
    model: str
    changelog: str
    rationale: str | None = None


@router.post("/admin/prompts/from-follow-up")
def create_prompt_from_follow_up(body: FollowUpCreateIn, session: DbSession, user: Admin):
    if body.model not in {m["name"] for m in prompt_evaluation.models()}:
        raise HTTPException(422, "unknown_model")
    try:
        row, manual = prompt_followup.create(
            session,
            author=user,
            base=body.baseVersion,
            proposal_ids=body.proposalIds,
            overrides=body.overrides,
            model=body.model,
            changelog=body.changelog,
            rationale=body.rationale,
        )
    except prompt_followup.FollowUpError as exc:
        raise follow_up_error(exc) from exc
    except PromptError as exc:
        raise bad_prompt(exc) from exc
    n = len(set(body.proposalIds))
    accounts.log(
        session,
        user,
        "prompt_published",
        f"Prompt v{row.version}",
        f"Creó el borrador v{row.version} desde Seguimiento con {n} reglas ({manual} editadas a mano).",
    )
    session.commit()
    return prompt_out(row)


@router.get("/admin/prompts/{version}")
def prompt_detail(version: str, session: DbSession, _: AdminReader):
    row = get_prompt(session, version)
    current = prompt_registry.ensure_bootstrap(session)
    session.commit()
    evaluation = prompt_evaluation.latest(session, version)
    return {
        "meta": prompt_out(row),
        "content": prompt_registry.content_of(row),
        "systemText": row.system_text,
        "spec": prompt_registry.reader(row),
        "activeVersion": current.version,
        "diff": None if current.version == row.version else prompt_registry.diff(current, row),
        "evaluation": evaluation_out(evaluation),
        # La vigente medida con sus corridas actuales sobre el mismo conjunto (sin gastar).
        "activeMetrics": prompt_evaluation.current_metrics(session),
        "loop": prompt_loop.for_version(session, version),
        "history": row.history or [],
    }


def tested(session: Session, version: str) -> PromptEvaluation:
    get_prompt(session, version)
    evaluation = prompt_evaluation.latest(session, version)
    if evaluation is None or evaluation.status != "done":
        raise HTTPException(409, "not_tested")
    return evaluation


@router.get("/admin/prompts/{version}/cause-analysis/estimate")
def cause_analysis_estimate(version: str, session: DbSession, user: AdminReader, source: str = "test"):
    """Costo estimado del análisis de causa de la prueba (mosaico, E1) o de la corrida completa. No gasta."""
    from call_audit.discrepancy_analysis import DEFAULT_MODEL

    return agreement.cause_estimate(session, verification_target(session, version, source, user), DEFAULT_MODEL)


@router.post("/admin/prompts/{version}/cause-analysis")
def start_cause_analysis(version: str, session: DbSession, user: Admin, source: str = "test"):
    """Lanza el análisis de causa (pagado). El worker lo corre; sus propuestas no van a la bandeja (R-11)."""
    from call_audit.discrepancy_analysis import DEFAULT_MODEL

    try:
        run = agreement.start_cause(session, verification_target(session, version, source, user), user, DEFAULT_MODEL)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    session.commit()
    return {"id": run.id, "status": run.status, "estimatedCostUsd": run.estimated_cost_usd}


Segment = Literal[
    "promptFn",
    "promptFp",
    "reviewer",
    "undecided",
    "agree",
    "agreePass",
    "agreeSame",
    "agreePartial",
    "agreeNone",
    "fp",
    "fn",
    "disagree",
    "changed",
    "all",
]
Source = Literal["test", "full"]
Tray = Literal["pending", "reviewed"]
Discrepancy = Literal["fn", "fp", "undecided", "criteria", "none"]
Sort = Literal["date", "reviewed", "ai", "reviewer", "call"]
Direction = Literal["asc", "desc"]
AiVerdict = Literal["compliant", "non_compliant", "uncertain"]
SheetVerdict = Literal["compliant", "non_compliant"]


def verification_target(session: Session, version: str, source: str, user: User) -> PromptEvaluation:
    """La prueba de la versión (pestaña Prueba) o su corrida completa (pestaña Verificación, 13-rol-verificador).
    El verificador solo ve la corrida completa."""
    if source == "full" or user.role == assignments.VERIFIER:
        get_prompt(session, version)
        evaluation = prompt_evaluation.latest_full(session, version)
        if evaluation is None:
            raise HTTPException(409, "no_full_run")
        return evaluation
    return tested(session, version)


@router.get("/admin/prompts/{version}/agreement/calls")
def agreement_calls(
    version: str,
    segment: Segment,
    session: DbSession,
    user: VerificationReader,
    criterion: int | None = None,
    vs: str | None = None,
    sample: int | None = None,
    source: Source = "test",
    assignee: str | None = None,
    tray: Tray | None = None,
    discrepancy: Discrepancy | None = None,
    sort: Sort | None = None,
    dir: Direction | None = None,  # noqa: A002
    rejected: int | None = None,
    ai_verdict: AiVerdict | None = None,
    reviewer_verdict: SheetVerdict | None = None,
):
    """Llamadas de una parte del mosaico (o de un lado, o de un motivo), en orden aleatorio fijo, con su verificación
    (04-verificacion-propuesta.md §9.1, 05-numeros-propuesta.md §7). Con `assignee`, solo las asignadas (13, V3).
    En la corrida completa, `tray` (Por revisar / Revisadas) y `discrepancy` filtran la lista del verificador (18)."""
    evaluation = verification_target(session, version, source, user)
    full = source == "full" or user.role == assignments.VERIFIER
    ids = assignments.scope_ids(session, evaluation, user, assignee) if full else None
    trayed = assignments.tray(session, evaluation, ids, tray, discrepancy, criterion) if full else None
    if trayed is not None and (tray or discrepancy):
        ids = set(trayed["ids"])
    facets = None
    if full and tray:
        # Filtros de las bandejas (21, Z1 A): criterio rechazado por Qubyt, veredicto de Qubyt y del revisor.
        ids, facets = verification.tray_facets(
            session, assignments.scoped(evaluation, ids), rejected, ai_verdict, reviewer_verdict
        )
    try:
        data = verification.segment_calls(session, assignments.scoped(evaluation, ids), segment, criterion, vs, sample)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    found = assignments.assignment_map(session, [i["caseId"] for i in data["items"]])
    for it in data["items"]:
        a = found.get(it["caseId"])
        it["assigneeName"] = a.user.name if a and a.user else None
        it["reviewedAt"] = a.reviewed_at.isoformat() if a and a.reviewed_at else None
        if trayed is not None:
            it["lastReviewedAt"] = trayed["lastReviewedAt"].get(it["caseId"])
            it["discrepancy"] = assignments.discrepancy_of(it)
    if facets is not None:
        data.update(facets)
    if trayed is not None:
        data["discrepancyCounts"] = trayed["discrepancyCounts"]
        data["tray"] = tray
        data["discrepancy"] = discrepancy
        if tray == "reviewed":
            rank = {cid: i for i, cid in enumerate(trayed["ids"])}
            data["items"].sort(key=lambda it: rank.get(it["caseId"], len(rank)))
    # Orden por columna (19, X4 A): sobre el orden de la bandeja, que desempata.
    data["items"] = verification.sort_items(data["items"], sort, dir, trayed["lastReviewedAt"] if trayed else {})
    data["sort"], data["dir"] = sort, dir
    return data


@router.get("/admin/prompts/{version}/agreement/calls/{case_id}")
def agreement_case(
    version: str,
    case_id: str,
    session: DbSession,
    user: VerificationReader,
    segment: str = "",
    criterion: int | None = None,
    source: Source = "test",
    assignee: str | None = None,
    tray: Tray | None = None,
    discrepancy: Discrepancy | None = None,
    sort: Sort | None = None,
    dir: Direction | None = None,  # noqa: A002
    rejected: int | None = None,
    ai_verdict: AiVerdict | None = None,
    reviewer_verdict: SheetVerdict | None = None,
):
    """Una llamada con lo que dijo la IA de esa versión frente a la planilla, motivo por motivo (§9.2), con a quién
    está asignada y si quien la mira puede registrar (13, V4). Con `tray`/`discrepancy`, Anterior/Siguiente recorren
    esa bandeja (18)."""
    evaluation = verification_target(session, version, source, user)
    full = source == "full" or user.role == assignments.VERIFIER
    ids = assignments.scope_ids(session, evaluation, user, assignee) if full else None
    trayed = None
    if full and (tray or discrepancy):
        trayed = assignments.tray(session, evaluation, ids, tray, discrepancy)
        # La llamada abierta sigue en su lista aunque acabe de salir de la bandeja (p. ej. al registrar el último
        # criterio), para que «llamada i de t» y Siguiente no salten.
        keep = {case_id} if ids is None or case_id in ids else set()
        ids = set(trayed["ids"])
        if tray:  # los mismos filtros que la lista (21, Z1 A)
            ids, _ = verification.tray_facets(
                session, assignments.scoped(evaluation, ids), rejected, ai_verdict, reviewer_verdict
            )
        ids = ids | keep
    scoped = assignments.scoped(evaluation, ids)
    try:
        data = verification.case_comparison(session, scoped, segment, case_id, criterion)
    except LookupError:
        try:  # La llamada no está en el filtro (p. ej. es de otra persona): se ve igual, sin lista alrededor.
            data = verification.case_comparison(session, evaluation, "", case_id, None)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
    row = assignments.assignment_map(session, [case_id]).get(case_id)
    data["assignment"] = assignments.assignment_out(row, user)
    data["canRecord"] = assignments.can_record(session, user, case_id) if full else user.role == "qubico_admin"
    data["source"] = "full" if full else "test"
    data["verifiers"] = (
        [{"id": u.id, "name": u.name} for u in assignments.verifiers(session)]
        if full and user.role == "qubico_admin"
        else []
    )
    if full:
        # En la corrida completa, pendiente incluye las llamadas sin desacuerdos aún sin «Sin observaciones» (V1 B).
        listed = verification.segment_calls(
            session, scoped, segment if segment in verification.LISTS else "all", criterion
        )
        found = assignments.assignment_map(session, [i["caseId"] for i in listed["items"]])
        data["position"]["pending"] = sum(
            1 for i in listed["items"] if not assignments.is_reviewed(i, found.get(i["caseId"]))
        )
        in_order = listed["items"]
        if tray == "reviewed" and trayed is not None:
            rank = {cid: i for i, cid in enumerate(trayed["ids"])}
            in_order = sorted(in_order, key=lambda i: rank.get(i["caseId"], -1))
        # Anterior/Siguiente recorren la bandeja en el orden que se ve (19, X5 A).
        in_order = verification.sort_items(in_order, sort, dir, trayed["lastReviewedAt"] if trayed else {})
        ordered = [i["caseId"] for i in in_order]
        if (tray == "reviewed" and trayed is not None) or sort is not None:
            if case_id in ordered:
                at = ordered.index(case_id)
                data["position"].update(
                    index=at + 1,
                    total=len(ordered),
                    prevCaseId=ordered[at - 1] if at > 0 else None,
                    nextCaseId=ordered[at + 1] if at < len(ordered) - 1 else None,
                )
        if user.role == assignments.VERIFIER:
            data["position"]["nextPendingCaseId"] = assignments.next_pending(
                session, evaluation, user, ordered, case_id
            )
    for c in data["criteria"]:
        v = c.get("verification")
        if v is not None:
            rec = verification.records_for(session, [case_id]).get((case_id, c["criterionId"]))
            v["canChange"] = data["canRecord"] and assignments.can_change_record(
                user, rec.decided_by_id if rec else None
            )
    return data


class VerificationIn(BaseModel):
    # Veredicto de calibración (23-modulo-de-calibracion): el correcto del criterio; el `outcome` se deriva. El
    # `outcome` directo queda por compatibilidad.
    verdict: Literal["compliant", "non_compliant"] | None = None
    outcome: Literal["ai_error", "reviewer_error", "ambiguous", "missing_info", "both_right", "both_wrong"] | None = (
        None
    )
    note: str | None = None
    version: str
    seenFirst: bool = False  # noqa: N815
    source: Source = "test"


def check_can_record(session: Session, user: User, case_id: str, criterion_id: int, full: bool) -> None:
    if user.role == "qubico_admin":
        return
    if not full or not assignments.can_record(session, user, case_id):
        raise HTTPException(403, "not_assigned")
    rec = verification.records_for(session, [case_id]).get((case_id, criterion_id))
    if rec is not None and not assignments.can_change_record(user, rec.decided_by_id):
        raise HTTPException(403, "not_owner")


@router.put("/admin/verifications/{case_id}/{criterion_id}")
def put_verification(
    case_id: str, criterion_id: int, body: VerificationIn, session: DbSession, user: VerificationReader
):
    """Registra quién tenía razón en un desacuerdo (§9.3). El admin en cualquier llamada; el verificador solo en las
    suyas y sin pisar registros de otros (13, V4 y V9). La cuenta de lectura recibe 403."""
    full = body.source == "full" or user.role == assignments.VERIFIER
    check_can_record(session, user, case_id, criterion_id, full)
    try:
        row = verification.record(
            session,
            verification_target(session, body.version, body.source, user),
            user,
            case_id,
            criterion_id,
            body.outcome,
            body.note,
            body.seenFirst,
            body.verdict,
        )
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:  # p. ej. «los dos se equivocaron» en un desacuerdo (20, Y2 A)
        raise HTTPException(400, str(exc)) from exc
    session.commit()
    reviewer = verification.FAIL if row.reviewer_fail_at else verification.PASS
    return verification.record_out(row, False, reviewer=reviewer)


@router.delete("/admin/verifications/{case_id}/{criterion_id}", status_code=204)
def delete_verification(case_id: str, criterion_id: int, session: DbSession, user: VerificationReader) -> None:
    check_can_record(session, user, case_id, criterion_id, True)
    verification.remove(session, user, case_id, criterion_id)
    session.commit()


class DraftIn(BaseModel):
    content: str
    model: str
    changelog: str
    rationale: str | None = None


@router.put("/admin/prompts/{version}")
def update_prompt(version: str, body: DraftIn, session: DbSession, user: Admin):
    row = get_prompt(session, version)
    try:
        prompt_registry.update_draft(
            session,
            row,
            author=user,
            content=body.content,
            model=body.model,
            changelog=body.changelog,
            rationale=body.rationale,
        )
    except PromptError as exc:
        raise bad_prompt(exc) from exc
    session.commit()
    return prompt_out(row)


@router.post("/admin/prompts/{version}/discard", status_code=204)
def discard_prompt(version: str, session: DbSession, user: Admin) -> None:
    row = get_prompt(session, version)
    if row.status != "draft":
        raise HTTPException(409, "immutable")
    session.delete(row)
    discrepancy_runs.release_version(session, version)
    accounts.log(session, user, "prompt_discarded", f"Prompt v{version}")
    session.commit()


@router.get("/admin/prompts/{version}/estimate")
def estimate_prompt(version: str, session: DbSession, _: AdminReader, model: str | None = None):
    row = get_prompt(session, version)
    return prompt_evaluation.estimate(session, model or row.model)


class EvaluationIn(BaseModel):
    model: str | None = None
    confirm: bool = False


@router.post("/admin/prompts/{version}/evaluation")
def start_evaluation(version: str, body: EvaluationIn, session: DbSession, user: Admin):
    if not body.confirm:
        raise HTTPException(422, "confirm_required")
    row = get_prompt(session, version)
    try:
        evaluation = prompt_evaluation.start(session, row, user, body.model)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    accounts.log(
        session,
        user,
        "prompt_tested",
        f"Prompt v{version}",
        f"{len(evaluation.case_ids)} llamadas · estimado {evaluation.estimated_cost_usd or 0:.4f} USD",
    )
    session.commit()
    return evaluation_out(evaluation)


@router.post("/admin/prompts/{version}/evaluation/stop", status_code=204)
def stop_evaluation(version: str, session: DbSession, user: Admin) -> None:
    evaluation = prompt_evaluation.latest(session, version)
    if evaluation is None:
        raise HTTPException(404, "not_found")
    try:
        prompt_evaluation.stop(session, evaluation, user)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    accounts.log(session, user, "prompt_test_stopped", f"Prompt v{version}", f"{evaluation.cost_usd:.4f} USD gastados")
    session.commit()


class ActivateIn(BaseModel):
    reason: str


@router.post("/admin/prompts/{version}/activate", status_code=204)
def activate_prompt(version: str, body: ActivateIn, session: DbSession, user: Admin) -> None:
    row = get_prompt(session, version)
    try:
        rollback = prompt_registry.activate(session, row, actor=user, reason=body.reason)
    except PromptError as exc:
        raise bad_prompt(exc) from exc
    accounts.log(
        session, user, "prompt_rolled_back" if rollback else "prompt_activated", f"Prompt v{version}", body.reason
    )
    session.commit()


@router.get("/admin/prompts/{version}/export")
def export_prompt(version: str, session: DbSession, _: AdminReader) -> Response:
    row = get_prompt(session, version)
    return Response(
        prompt_registry.export_zip(row),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="prompt-v{version}.zip"'},
    )


# --- Estadísticas del sistema (sin métricas por persona) ----------------------------------------------------------


Period = Literal["7d", "30d"]
PERIOD_DAYS: dict[str, int] = {"7d": 7, "30d": 30}
MAX_DAILY_BARS = 31
CHILE = ZoneInfo("America/Santiago")


def p95(values: list[int]) -> int:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))] if ordered else 0


def chile_day(value: datetime) -> date:
    return accounts.aware(value).astimezone(CHILE).date()


def period_bounds(period: Period | None, today: date) -> tuple[date, date] | None:
    """Días calendario de Chile que cubre el periodo, hoy incluido. None = todo el historial."""
    return (today - timedelta(days=PERIOD_DAYS[period] - 1), today) if period else None


def in_bounds(day: date, bounds: tuple[date, date] | None) -> bool:
    return bounds is None or bounds[0] <= day <= bounds[1]


def first_run_days(runs: Iterable[Any]) -> dict[str, date]:
    """Día de la primera corrida sin error de cada llamada, entre las corridas recibidas."""
    first: dict[str, date] = {}
    for r in runs:
        if not r.error:
            day = chile_day(r.run_at)
            first[r.case_id] = min(day, first.get(r.case_id, day))
    return first


def days_between(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def processed_series(days: list[date], bounds: tuple[date, date] | None) -> tuple[list[dict[str, Any]], str]:
    """Serie del gráfico, con 0 en los días sin procesamiento. Con periodo cubre el periodo completo; sin periodo va
    de la primera a la última fecha con llamadas y, si pasa de MAX_DAILY_BARS, se agrupa por semana (desde el lunes)."""
    if not days:
        return [], "day"
    start, end = bounds or (min(days), max(days))
    if bounds is None and (end - start).days + 1 > MAX_DAILY_BARS:
        weeks = Counter(d - timedelta(days=d.weekday()) for d in days)
        mondays = days_between(start - timedelta(days=start.weekday()), end)[::7]
        return [{"date": m.isoformat(), "calls": weeks[m]} for m in mondays], "week"
    by_day = Counter(days)
    return [{"date": d.isoformat(), "calls": by_day[d]} for d in days_between(start, end)], "day"


def reviewed_per_day(days: list[date], bounds: tuple[date, date] | None, today: date) -> float:
    """Revisiones del periodo por día. Sin periodo, desde la primera revisión hasta hoy."""
    if bounds:
        return round(sum(in_bounds(d, bounds) for d in days) / ((bounds[1] - bounds[0]).days + 1), 1)
    return round(len(days) / ((today - min(days)).days + 1), 1) if days else 0.0


def filter_options(session: Session) -> dict[str, Any]:
    """Opciones de Modelo y Prompt: toda la historia, sin recortarse entre sí."""
    pairs = session.execute(select(ModelRun.model, ModelRun.prompt_version).distinct()).all()
    toml = prompt_evaluation.all_models()
    order = {m["name"]: i for i, m in enumerate(toml)}
    labels = {m["name"]: m.get("label", m["name"]) for m in toml}
    models = sorted({p.model for p in pairs}, key=lambda m: (order.get(m, len(order)), m))
    return {
        "models": [{"id": m, "label": labels.get(m, m)} for m in models],
        "promptVersions": sorted({p.prompt_version for p in pairs}, key=prompt_registry.version_key, reverse=True),
    }


@router.get("/admin/stats")
def admin_stats(
    session: DbSession,
    _: AdminReader,
    period: Period | None = None,
    model: str | None = None,
    prompt: str | None = None,
):
    now = datetime.now(UTC)
    today = chile_day(now)
    bounds = period_bounds(period, today)
    cases = list(session.execute(select(Case.id, Case.duration_ms, Case.status, Case.queued_at)))
    query = select(
        ModelRun.case_id,
        ModelRun.run_at,
        ModelRun.error,
        ModelRun.run_label,
        ModelRun.model,
        ModelRun.prompt_version,
        ModelRun.cost_usd,
        ModelRun.latency_ms,
    )
    if model:
        query = query.where(ModelRun.model == model)
    if prompt:
        query = query.where(ModelRun.prompt_version == prompt)
    all_runs = list(session.execute(query))
    runs = [r for r in all_runs if in_bounds(chile_day(r.run_at), bounds)]
    # La primera corrida se busca en toda la historia y después se recorta: una re-corrida del periodo no cuenta.
    processed = {case: day for case, day in first_run_days(all_runs).items() if in_bounds(day, bounds)}
    duration = {c.id: c.duration_ms for c in cases}
    daily, daily_bucket = processed_series(list(processed.values()), bounds)
    run_days = [chile_day(r.run_at) for r in runs]
    review_days = [chile_day(at) for at in session.scalars(select(Review.submitted_at))]
    open_cases = [c for c in cases if c.status in OPEN_STATUSES]
    oldest = min((accounts.aware(c.queued_at) for c in open_cases), default=None)
    failed: dict[str, list[Any]] = defaultdict(list)
    for r in runs:
        if r.error:
            failed[r.run_label].append(r)

    groups: dict[tuple[str, str], list[Any]] = defaultdict(list)
    for r in runs:
        groups[(r.prompt_version, r.model)].append(r)
    cost = []
    for (version, run_model), items in sorted(groups.items(), key=lambda kv: prompt_registry.version_key(kv[0][0])):
        priced = [r for r in items if r.cost_usd]
        latencies = [r.latency_ms for r in items if r.latency_ms]
        cost.append(
            {
                "model": run_model,
                "promptVersion": version,
                "calls": len(items),
                "totalUsd": round(sum(r.cost_usd for r in items), 4),
                "perCallUsd": round(mean(r.cost_usd for r in priced), 6) if priced else 0.0,
                "tokensIn": None,
                "tokensOut": None,
                "latencyMsAvg": int(mean(latencies)) if latencies else 0,
                "latencyMsP95": p95(latencies),
            }
        )
    span = bounds or ((min(run_days), max(run_days)) if run_days else None)
    last_run = max((accounts.aware(r.run_at) for r in all_runs), default=None)
    return {
        "filters": {
            **filter_options(session),
            "range": {"from": span[0].isoformat(), "to": span[1].isoformat()} if span else None,
            "lastRunAt": iso(last_run),
        },
        "operation": {
            "callsProcessed": len(processed),
            "minutesProcessed": round(sum(duration[case] for case in processed) / 60_000),
            "medianHoursToResult": None,
            "batchesWithError": len(failed),
            "humanQueue": len(open_cases),
            "oldestQueueHours": round((now - oldest).total_seconds() / 3600, 1) if oldest else 0,
            "reviewedPerDay": reviewed_per_day(review_days, bounds, today),
            "daily": daily,
            "dailyBucket": daily_bucket,
            "failedBatches": [
                {
                    "batchId": label,
                    "at": iso(max(accounts.aware(r.run_at) for r in items)),
                    "stage": "modelo",
                    "calls": len(items),
                }
                for label, items in failed.items()
            ],
        },
        "cost": cost,
    }


# --- Calidad de la IA por corrida (Cambio 15) --------------------------------------------------------------------

# Metas del proyecto (docs/context.md): hasta 5 % de falsos positivos y 20 % de falsos negativos.
QUALITY_GOALS = {"falsePositivePct": 5, "falseNegativePct": 20}
# Motivos de tipificación que no se evalúan si la llamada no trae TIPIFICACION (real_calls.UNEVALUABLE).
UNEVALUABLE_WITHOUT_TYPIFICATION = frozenset(range(19, 26))


def fail_criteria(run: ModelRun) -> list[int]:
    return sorted(f["criterionId"] for f in run.findings or [] if f.get("verdict") == "non_compliant")


def quote_rate(runs: list[ModelRun]) -> float:
    evidence = [f["evidence"] for r in runs for f in r.findings or [] if f.get("evidence")]
    return round(100 * sum(e.get("quoteValidated") is False for e in evidence) / len(evidence), 1) if evidence else 0.0


def full_run_results(session: Session, evaluation: PromptEvaluation, split: str | None) -> list[dict]:
    """Los resultados de una corrida completa que caen en el set de medición (validación): la corrida completa pasa
    también por entrenamiento, y medir ahí inflaría la mejora (call_audit.golden_split)."""
    results = evaluation.results or []
    if split is None:
        return results
    ids = [r["caseId"] for r in results]
    cases = session.scalars(select(Case).where(Case.id.in_(ids))) if ids else []
    keep = {c.id for c in cases if golden_split.split_of(c) == split}
    return [r for r in results if r["caseId"] in keep]


def full_run_progress(session: Session, evaluation: PromptEvaluation, split: str | None) -> dict:
    """Avance de una corrida completa en curso contado en el set de medición: cuántas de sus llamadas de validación
    ya tienen resultado, de cuántas trae la corrida."""
    ids = evaluation.case_ids or []
    if split is None:
        total = len(ids)
    else:
        cases = session.scalars(select(Case).where(Case.id.in_(ids))) if ids else []
        total = sum(1 for c in cases if golden_split.split_of(c) == split)
    return {"done": len(full_run_results(session, evaluation, split)), "total": total}


def full_run_block(session: Session, evaluation: PromptEvaluation, split: str | None) -> dict | None:
    results = full_run_results(session, evaluation, split)
    stored = all("findings" in r or r.get("error") for r in results)
    return agreement.for_results(session, results, None, stored)


@router.get("/admin/quality")
def admin_quality(session: DbSession, _: AdminReader):
    """Versiones medidas sobre las llamadas de validación (05-numeros-propuesta.md §5, N5): la vigente con sus
    corridas de hoy y cada prueba de versión terminada en ese set. Cada una trae el bloque `agreement` (el mismo del
    mosaico), así que las cifras son las de la pestaña Prueba: la duda de la IA va aparte (N4). Sin IA."""
    toml = prompt_evaluation.all_models()
    order = {m["name"]: i for i, m in enumerate(toml)}
    labels = {m["name"]: m.get("label", m["name"]) for m in toml}
    split = prompt_evaluation.eval_split(session)
    series: list[dict] = []

    current = prompt_evaluation.current_metrics(session)
    active = session.scalar(select(PromptVersion).where(PromptVersion.status == "active"))
    if current and current.get("agreement") and active is not None:
        runs = discrepancy_runs.current_series(session) or {}
        series.append(
            {
                "id": "current",
                "model": runs.get("model") or active.model or "",
                "promptVersion": active.version,
                "runLabel": "Vigente",
                "source": "run",
                "isCurrent": True,
                "ranAt": None,
                "costPerCallUsd": current.get("costPerCallUsd"),
                "listVersion": None,
                "agreement": current["agreement"],
            }
        )

    running = None
    full_running: dict | None = None
    for ev in session.scalars(select(PromptEvaluation).order_by(PromptEvaluation.created_at)):
        if ev.status in ("queued", "running") and prompt_evaluation.is_test(ev):
            running = {"version": ev.version, "done": ev.done, "total": len(ev.case_ids)}
        if ev.purpose == "full" and ev.status in ("done", "queued", "running"):
            # La corrida en curso también entra, medida en las llamadas de validación que ya terminaron.
            in_progress = ev.status != "done"
            block = full_run_block(session, ev, split)
            if in_progress:
                full_running = {
                    "version": ev.version,
                    "seriesId": f"full:{ev.id}" if block is not None else None,
                    "done": ev.done,
                    "total": len(ev.case_ids or []),
                    "validation": full_run_progress(session, ev, split),
                }
            if block is not None:
                series.append(
                    {
                        "id": f"full:{ev.id}",
                        "model": ev.model,
                        "promptVersion": ev.version,
                        "runLabel": f"Corrida completa v{ev.version}",
                        "source": "full_run",
                        "isCurrent": False,
                        "ranAt": iso(accounts.aware(ev.finished_at or ev.started_at or ev.created_at)),
                        "costPerCallUsd": (ev.metrics or {}).get("costPerCallUsd"),
                        "listVersion": None,
                        "agreement": block,
                        "progress": full_running["validation"] if in_progress else None,
                    }
                )
            continue
        if ev.status != "done" or not prompt_evaluation.is_test(ev) or (split is not None and ev.split != split):
            continue
        block = with_verification(session, ev)
        if block is None:
            continue
        latest = prompt_evaluation.latest(session, ev.version)
        series.append(
            {
                "id": f"test:{ev.id}",
                "model": ev.model,
                "promptVersion": ev.version,
                "runLabel": f"Prueba v{ev.version}",
                "source": "prompt_test",
                "isCurrent": False,
                "ranAt": iso(accounts.aware(ev.finished_at or ev.created_at)),
                "costPerCallUsd": (ev.metrics or {}).get("costPerCallUsd"),
                # La lista de llamadas (/admin/prompts/[v]/calls) lee la última prueba de la versión.
                "listVersion": ev.version if latest is not None and latest.id == ev.id else None,
                "agreement": block,
            }
        )

    # Color fijo por modelo, en el orden de models.toml (H-100); los modelos que no están ahí van al final.
    models = sorted({s["model"] for s in series}, key=lambda m: (order.get(m, len(order)), m))
    for s in series:
        s.setdefault("progress", None)
        s["modelLabel"] = labels.get(s["model"], s["model"])
        s["colorIndex"] = models.index(s["model"]) % 6
    series.sort(key=lambda s: (prompt_registry.version_key(s["promptVersion"]), s["ranAt"] or ""))

    rubric = load_rubric(get_settings().rubric_path)
    return {
        "series": series,
        "criteria": [
            {"id": cid, "name": crit.description, "minor": cid in rubric.minor}
            for cid, crit in sorted(rubric.criteria.items())
        ],
        "goals": QUALITY_GOALS,
        "promptTestRunning": running,
        # Corrida completa en curso (14-corrida-en-curso.md): avance total y en validación; seriesId si ya tiene cifras.
        "fullRunRunning": full_running,
    }


@router.get("/admin/quality/grid")
def admin_quality_grid(series: str, session: DbSession, _: AdminReader):
    """Análisis por caso de una versión de Calidad de la IA (06-ajustes-feedback.md §2, F1): por llamada, su parte del
    mosaico y la clase de cada motivo en desacuerdo, sobre las mismas llamadas de validación. Sin IA."""
    if series == "current":
        results = prompt_evaluation.current_results(session)
        ids = [r["caseId"] for r in results]
        call_ids = dict(session.execute(select(Case.id, Case.call_id).where(Case.id.in_(ids))).all()) if ids else {}
        rows = agreement.call_rows(results, call_ids, set(), golden_split.layer2_criteria())
        version = None
    elif series.startswith("test:"):
        ev = session.get(PromptEvaluation, series.removeprefix("test:"))
        if ev is None or ev.status != "done":
            raise HTTPException(404, "not_found")
        rows, _patterns = verification.evaluation_rows(session, ev)
        latest = prompt_evaluation.latest(session, ev.version)
        version = ev.version if latest is not None and latest.id == ev.id else None
    elif series.startswith("full:"):
        ev = session.get(PromptEvaluation, series.removeprefix("full:"))
        if ev is None or ev.status not in ("done", "queued", "running") or ev.purpose != "full":
            raise HTTPException(404, "not_found")
        results = full_run_results(session, ev, prompt_evaluation.eval_split(session))
        ids = [r["caseId"] for r in results]
        call_ids = dict(session.execute(select(Case.id, Case.call_id).where(Case.id.in_(ids))).all()) if ids else {}
        rows = agreement.call_rows(results, call_ids, set(), golden_split.layer2_criteria())
        version = None
    else:
        raise HTTPException(404, "not_found")
    cases = {c.id: c for c in session.scalars(select(Case).where(Case.id.in_([r["caseId"] for r in rows])))}
    return {
        "listVersion": version,
        "criteria": golden_split.layer2_criteria(),
        "calls": [
            {
                "caseId": r["caseId"],
                "callId": r["callId"],
                "typification": out.typification_out(cases[r["caseId"]]) if r["caseId"] in cases else None,
                "segment": r["segment"],
                "reviewerVerdict": r["result"]["external"],
                "aiVerdict": r["result"]["verdict"],
                # [motivo, clase, azul] de lo que no coincide, más "both" si ambos marcan No cumple (verde);
                # lo que no aparece es que ninguno lo marca.
                "items": [
                    [i["criterionId"], i["kind"] if i["kind"] != "agree" else "both", i["blue"]]
                    for i in r["items"]
                    if i["kind"] != "agree" or i["criterionId"] in set(r["result"].get("failCriteria") or [])
                ],
            }
            for r in sorted(rows, key=lambda r: r["callId"])
        ],
    }


# --- Procesamiento (Cambio 14) -----------------------------------------------------------------------------------

# Sin latido en este tiempo, el worker "no responde" aunque haya una pasada abierta (H-80): el latido es cada ~30 s.
STALE_AFTER = timedelta(minutes=3)


def run_out(run: PipelineRun | None) -> dict | None:
    if run is None:
        return None
    return {
        "id": run.id,
        "startedAt": iso(accounts.aware(run.started_at)),
        "finishedAt": iso(accounts.aware(run.finished_at)),
        "status": run.status,
        "stage": run.stage if run.status == "running" else None,
        "audios": run.audios,
        "waitingMetadata": run.waiting_metadata,
        "batchSize": run.batch_size,
        "remaining": run.remaining,
        "transcribeTotal": run.transcribe_total,
        "transcribed": run.transcribed,
        "asrErrors": run.asr_errors,
        "asrRateLimited": run.asr_rate_limited,
        "validateTotal": run.validate_total,
        "validated": run.validated,
        "archived": run.archived,
        "error": run.error,
    }


def worker_state(beat: WorkerHeartbeat | None, current: PipelineRun | None, last: PipelineRun | None) -> str:
    """El estado se calcula acá, no en el front, para no comparar relojes (Cambio 14 §3.2). `stale` le gana a todo."""
    if beat is None:
        return "no_data"
    if datetime.now(UTC) - accounts.aware(beat.last_seen_at) > STALE_AFTER:
        return "stale"
    if current is not None:
        return "running"
    if last is not None and last.status == "failed":
        return "last_failed"
    return "idle"


@router.get("/admin/processing")
def processing_status(session: DbSession, _: AdminReader):
    beat = session.get(WorkerHeartbeat, 1)
    latest = select(PipelineRun).order_by(PipelineRun.id.desc()).limit(1)
    current = session.scalar(latest.where(PipelineRun.status == "running"))
    last = session.scalar(latest.where(PipelineRun.status != "running"))
    state = worker_state(beat, current, last)
    evaluation = session.scalar(
        select(PromptEvaluation)
        .where(PromptEvaluation.status.in_(("queued", "running")))
        .order_by(PromptEvaluation.created_at.desc())
        .limit(1)
    )
    queued = session.scalar(select(func.count()).select_from(CatalogUpload).where(CatalogUpload.status == "processing"))
    discrepancy = discrepancy_runs.running(session)
    return {
        "state": state,
        "stage": current.stage if current is not None and state == "running" else None,
        "lastHeartbeatAt": iso(accounts.aware(beat.last_seen_at)) if beat else None,
        "nextRunAt": iso(accounts.aware(beat.next_run_at)) if beat else None,
        "loopSeconds": beat.loop_seconds if beat else None,
        "currentRun": run_out(current) if state == "running" else None,
        "lastRun": run_out(last),
        "otherTasks": {
            "catalogUploadsQueued": queued or 0,
            "promptEvaluation": {
                "version": evaluation.version,
                "processed": evaluation.done,
                "n": len(evaluation.case_ids or []),
            }
            if evaluation
            else None,
            "discrepancyAnalysis": {
                "id": discrepancy.id,
                "done": len(discrepancy.done_criteria) + len(discrepancy.failed_criteria),
                "total": len(discrepancy.criteria),
            }
            if discrepancy
            else None,
        },
    }


@router.get("/admin/processing/runs")
def pipeline_runs(session: DbSession, _: AdminReader, limit: int = 20):
    rows = session.scalars(select(PipelineRun).order_by(PipelineRun.id.desc()).limit(max(1, min(limit, 200))))
    return [run_out(run) for run in rows]


@router.get("/admin/processing/asr-failures")
def asr_failures(session: DbSession, _: AdminReader):
    rows = session.scalars(select(AsrFailure).order_by(AsrFailure.last_attempt_at.desc()))
    return [
        {
            "stem": r.stem,
            "error": r.error,
            "attempts": r.attempts,
            "lastAttemptAt": iso(accounts.aware(r.last_attempt_at)),
        }
        for r in rows
    ]


# --- Registro de actividad ---------------------------------------------------------------------------------------


@router.get("/admin/activity")
def activity(session: DbSession, _: AdminReader, limit: int = 500):
    rows = session.scalars(select(AccessLog).order_by(AccessLog.created_at.desc(), AccessLog.id.desc()).limit(limit))
    return [
        {
            "id": str(r.id),
            "at": iso(r.created_at),
            "actorId": r.user_id,
            "actorName": r.user.name if r.user else r.user_id,
            "actorRole": r.user.role if r.user else "auditor",
            "action": r.action,
            "target": r.target,
            "details": r.details or "",
        }
        for r in rows
    ]
