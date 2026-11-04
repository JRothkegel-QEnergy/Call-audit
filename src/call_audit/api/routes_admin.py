"""Administrador Qubico (Cambio 12): cuentas, versiones del prompt, estadísticas del sistema y registro de actividad.
Procesamiento (Cambio 14): estado del worker, avance de la pasada en curso y fallas de transcripción.
También las rutas públicas de invitación y restablecimiento de contraseña (/api/auth/invite, /api/auth/forgot).

Sin métricas por persona (L-06, L-22, L-31). Los errores que el front distingue van como código en `detail`.
"""

from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from statistics import mean
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from call_audit import accounts, discrepancy_runs, prompt_evaluation, prompt_registry
from call_audit.api import serializers as out
from call_audit.api.deps import Admin, CurrentUser, DbSession, set_session
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
Role = Literal["auditor", "supervisor", "qubico_admin"]
PERMISSIONS = {"auditor": {"view_model_io"}, "supervisor": {"manage_catalog"}, "qubico_admin": set()}
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
        "metrics": evaluation.metrics,
    }


def get_prompt(session: Session, version: str) -> PromptVersion:
    row = session.get(PromptVersion, version)
    if row is None:
        raise HTTPException(404, "not_found")
    return row


def bad_prompt(exc: PromptError) -> HTTPException:
    return HTTPException(422, {"code": "invalid_prompt", "errors": exc.errors})


@router.get("/admin/models")
def list_models(_: Admin):
    return [{"name": m["name"], "provider": m["provider"]} for m in prompt_evaluation.models()]


@router.get("/prompts/active")
def active_prompt(session: DbSession, _: CurrentUser):
    """Para el aviso a supervisores "Desde el {fecha} se usa el prompt v{x}"."""
    row = prompt_registry.ensure_bootstrap(session)
    session.commit()
    return {"version": row.version, "since": iso(row.activated_at), "changedInApp": row.activated_by_id is not None}


@router.get("/admin/prompts")
def list_prompts(session: DbSession, _: Admin):
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
    # Propuestas aceptadas del análisis de discrepancias que entran en esta versión (Cambio 16, D-68).
    includedProposalIds: list[str] = []


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
    try:
        discrepancy_runs.include_in_version(session, body.includedProposalIds, row.version)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    accounts.log(session, user, "prompt_published", f"Prompt v{row.version}", body.changelog.strip()[:500])
    session.commit()
    return prompt_out(row)


@router.get("/admin/prompts/{version}")
def prompt_detail(version: str, session: DbSession, _: Admin):
    row = get_prompt(session, version)
    current = prompt_registry.ensure_bootstrap(session)
    session.commit()
    evaluation = prompt_evaluation.latest(session, version)
    return {
        "meta": prompt_out(row),
        "content": prompt_registry.content_of(row),
        "systemText": row.system_text,
        "activeVersion": current.version,
        "diff": None if current.version == row.version else prompt_registry.diff(current, row),
        "evaluation": evaluation_out(evaluation),
        # La vigente medida con sus corridas actuales sobre el mismo conjunto (sin gastar).
        "activeMetrics": prompt_evaluation.current_metrics(session),
        "history": row.history or [],
    }


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
def estimate_prompt(version: str, session: DbSession, _: Admin, model: str | None = None):
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
def export_prompt(version: str, session: DbSession, _: Admin) -> Response:
    row = get_prompt(session, version)
    return Response(
        prompt_registry.export_zip(row),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="prompt-v{version}.zip"'},
    )


# --- Estadísticas del sistema (sin métricas por persona) ----------------------------------------------------------


def p95(values: list[int]) -> int:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))] if ordered else 0


@router.get("/admin/stats")
def admin_stats(session: DbSession, _: Admin):
    now = datetime.now(UTC)
    cases = list(session.scalars(select(Case)))
    runs = list(session.scalars(select(ModelRun)))
    open_cases = [c for c in cases if c.status in OPEN_STATUSES]
    oldest = min((accounts.aware(c.queued_at) for c in open_cases), default=None)
    week_ago = now - timedelta(days=7)
    reviews = session.scalar(select(func.count()).select_from(Review).where(Review.submitted_at >= week_ago)) or 0
    by_day = Counter(c.call_date for c in cases)
    failed: dict[str, list[ModelRun]] = defaultdict(list)
    for r in runs:
        if r.error:
            failed[r.run_label].append(r)

    groups: dict[tuple[str, str], list[ModelRun]] = defaultdict(list)
    for r in runs:
        groups[(r.prompt_version, r.model)].append(r)
    cost = []
    for (version, model), items in sorted(groups.items(), key=lambda kv: prompt_registry.version_key(kv[0][0])):
        priced = [r for r in items if r.cost_usd]
        latencies = [r.latency_ms for r in items if r.latency_ms]
        cost.append(
            {
                "model": model,
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
    return {
        "operation": {
            "callsProcessed": len(cases),
            "minutesProcessed": round(sum(c.duration_ms for c in cases) / 60_000),
            "medianHoursToResult": None,
            "batchesWithError": len(failed),
            "humanQueue": len(open_cases),
            "oldestQueueHours": round((now - oldest).total_seconds() / 3600, 1) if oldest else 0,
            "reviewedPerDay": round(reviews / 7, 1),
            "daily": [{"date": d, "calls": by_day[d]} for d in sorted(by_day)[-14:]],
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


@router.get("/admin/quality")
def admin_quality(session: DbSession, _: Admin):
    """Corridas (modelo + `run_label`, más las pruebas del prompt terminadas) contra el veredicto y la marca por
    motivo del cliente. Datos por llamada: las métricas las calcula el front (H-99). Sin nombres de ejecutivos."""
    cases = list(session.scalars(select(Case).where(Case.external_verdict.is_not(None)).order_by(Case.call_id)))
    ids = {c.id for c in cases}
    toml = prompt_evaluation.all_models()
    order = {m["name"]: i for i, m in enumerate(toml)}
    labels = {m["name"]: m.get("label", m["name"]) for m in toml}

    groups: dict[tuple[str, str], list[ModelRun]] = defaultdict(list)
    for r in session.scalars(select(ModelRun).where(ModelRun.case_id.in_(ids))):
        groups[(r.model, r.run_label)].append(r)
    series: list[dict] = []
    results: dict[str, dict[str, dict | None]] = defaultdict(dict)
    for (model, label), items in groups.items():
        sid = f"run:{model}:{label}"
        priced = [r.cost_usd for r in items if r.cost_usd]
        series.append(
            {
                "id": sid,
                "model": model,
                "promptVersion": items[0].prompt_version,
                "runLabel": label,
                "source": "run",
                "isCurrent": any(r.is_current for r in items),
                "ranAt": iso(max(accounts.aware(r.run_at) for r in items)),
                "calls": len(items),
                "costPerCallUsd": round(mean(priced), 6) if priced else None,
                "unvalidatedQuoteRate": quote_rate(items),
            }
        )
        for r in items:
            results[r.case_id][sid] = None if r.error else {"verdict": r.verdict, "failCriteria": fail_criteria(r)}

    running = None
    for ev in session.scalars(select(PromptEvaluation).order_by(PromptEvaluation.created_at)):
        if ev.status in ("queued", "running"):
            running = {"version": ev.version, "done": ev.done, "total": len(ev.case_ids)}
        if ev.status != "done":
            continue
        sid = f"test:{ev.id}"
        rows = [r for r in ev.results if r["caseId"] in ids]
        quotes = sum(r.get("quotes", 0) for r in rows)
        series.append(
            {
                "id": sid,
                "model": ev.model,
                "promptVersion": ev.version,
                "runLabel": f"Prueba v{ev.version}",
                "source": "prompt_test",
                "isCurrent": False,
                "ranAt": iso(accounts.aware(ev.finished_at or ev.created_at)),
                "calls": len(rows),
                "costPerCallUsd": (ev.metrics or {}).get("costPerCallUsd"),
                "unvalidatedQuoteRate": round(100 * sum(r.get("unvalidatedQuotes", 0) for r in rows) / quotes, 1)
                if quotes
                else 0.0,
            }
        )
        for r in rows:
            results[r["caseId"]][sid] = (
                None if r.get("error") else {"verdict": r["verdict"], "failCriteria": sorted(r.get("failCriteria", []))}
            )

    # Color fijo por modelo, en el orden de models.toml (H-100); los modelos que no están ahí van al final.
    models = sorted({s["model"] for s in series}, key=lambda m: (order.get(m, len(order)), m))
    for s in series:
        s["modelLabel"] = labels.get(s["model"], s["model"])
        s["colorIndex"] = models.index(s["model"]) % 6
    series.sort(key=lambda s: (models.index(s["model"]), prompt_registry.version_key(s["promptVersion"]), s["ranAt"]))

    rubric = load_rubric(get_settings().rubric_path)
    return {
        "series": series,
        "calls": [
            {
                "caseId": c.id,
                "callId": c.call_id,
                "callDate": c.call_date,
                "clientVerdict": c.external_verdict,
                "clientFails": c.external_item_fails,
                "results": results.get(c.id, {}),
            }
            for c in cases
        ],
        "criteria": [
            {
                "id": cid,
                "name": crit.description,
                "minor": cid in rubric.minor,
                "byCode": "layer1" in crit.layers,
                "partial": cid in UNEVALUABLE_WITHOUT_TYPIFICATION,
            }
            for cid, crit in sorted(rubric.criteria.items())
        ],
        "goals": QUALITY_GOALS,
        "promptTestRunning": running,
        # "Ver por qué" en los motivos de la corrida vigente con patrones (Cambio 16, D-62).
        "currentSeriesPatternCounts": discrepancy_runs.pattern_counts(session),
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
def processing_status(session: DbSession, _: Admin):
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
def pipeline_runs(session: DbSession, _: Admin, limit: int = 20):
    rows = session.scalars(select(PipelineRun).order_by(PipelineRun.id.desc()).limit(max(1, min(limit, 200))))
    return [run_out(run) for run in rows]


@router.get("/admin/processing/asr-failures")
def asr_failures(session: DbSession, _: Admin):
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
def activity(session: DbSession, _: Admin, limit: int = 500):
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
