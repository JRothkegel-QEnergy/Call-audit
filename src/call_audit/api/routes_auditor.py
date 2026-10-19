"""Sesión, pauta y flujo del auditor: cola, caso, revisión, escalamiento y notas."""

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func, select

from call_audit.api import serializers as out
from call_audit.api.deps import CurrentUser, DbSession, clear_session, optional_user, set_session, verify_password
from call_audit.config import Settings, get_settings
from call_audit.persistence.models import Agent, Alert, Case, Note, PromptVersion, Review, User
from call_audit.rubric import Rubric, load_rubric

router = APIRouter(prefix="/api")

Verdict = Literal["compliant", "non_compliant", "uncertain", "not_applicable"]
CallVerdict = Literal["compliant", "non_compliant", "uncertain"]
OPEN_STATUSES = ("pending", "in_review", "reopened")
REOPEN_PREFIX = "Reabierto: "


def get_rubric() -> Rubric:
    return load_rubric(get_settings().rubric_path)


RubricDep = Annotated[Rubric, Depends(get_rubric)]


def get_case(session: DbSession, case_id: str) -> Case:
    case = session.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "Caso no encontrado")
    return case


def start_of_today() -> datetime:
    return datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)


# --- Sesión ---------------------------------------------------------------------------


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(body: LoginIn, response: Response, session: DbSession, settings: Annotated[Settings, Depends(get_settings)]):
    user = session.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or user.status != "active" or not verify_password(user, body.password):
        raise HTTPException(401, "Correo o contraseña incorrectos")
    set_session(response, user, settings)
    return out.user_out(user)


@router.post("/auth/logout", status_code=204)
def logout(response: Response, settings: Annotated[Settings, Depends(get_settings)]) -> None:
    clear_session(response, settings)


@router.get("/auth/me")
def me(user: Annotated[User | None, Depends(optional_user)]):
    return out.user_out(user) if user else None


@router.get("/rubric")
def rubric(_: CurrentUser, rubric: RubricDep):
    return out.rubric_out(rubric)


# --- Cola -----------------------------------------------------------------------------


def queue_rows(
    session: DbSession,
    user: User,
    rubric: Rubric,
    agent_id: str | None,
    engine_verdict: str | None,
    block_id: str | None,
) -> list[dict]:
    cases = session.scalars(select(Case).where(Case.status.in_(OPEN_STATUSES))).all()
    rows = []
    for case in cases:
        if case.assigned_auditor_id and case.assigned_auditor_id != user.id:
            continue
        row = out.case_summary(case, rubric, user)
        if agent_id and row["agent"]["id"] != agent_id:
            continue
        if engine_verdict and engine_verdict != "sample" and row["engineVerdict"] != engine_verdict:
            continue
        if block_id:
            run = out.current_run(case)
            block = {c for b in rubric.blocks if b.id == block_id for c in b.criteria}
            if not run or not any(f["criterionId"] in block and f["verdict"] != "compliant" for f in run.findings):
                continue
        rows.append(row)
    # Lo más grave primero: críticos, más motivos incumplidos, dudosos; a igualdad, los más antiguos.
    order = {"non_compliant": 0, "uncertain": 1, "compliant": 2}
    rows.sort(key=lambda r: (not r["hasCritical"], order[r["engineVerdict"]], -r["nonCompliantCount"], r["queuedAt"]))
    return rows


@router.get("/queue")
def list_queue(
    session: DbSession,
    user: CurrentUser,
    rubric: RubricDep,
    agentId: str | None = None,  # noqa: N803
    engineVerdict: str | None = None,
    blockId: str | None = None,
):  # noqa: N803
    rows = queue_rows(session, user, rubric, agentId, engineVerdict, blockId)
    reviewed = session.scalar(
        select(func.count())
        .select_from(Review)
        .where(Review.auditor_id == user.id, Review.submitted_at >= start_of_today())
    )
    # total = toda la cola, sin filtros (igual que el mock): el front muestra "n de total".
    total = (
        len(rows)
        if not (agentId or engineVerdict or blockId)
        else len(queue_rows(session, user, rubric, None, None, None))
    )
    return {"rows": rows, "total": total, "reviewedToday": reviewed or 0}


class QueueFiltersIn(BaseModel):
    agentId: str | None = None  # noqa: N815
    engineVerdict: str | None = None  # noqa: N815
    blockId: str | None = None  # noqa: N815


@router.post("/queue/next")
def take_next_case(body: QueueFiltersIn, session: DbSession, user: CurrentUser, rubric: RubricDep):
    for row in queue_rows(session, user, rubric, body.agentId, body.engineVerdict, body.blockId):
        if row["lockedBy"] in (None, {"id": user.id, "name": user.name}):
            case = get_case(session, row["id"])
            case.locked_by_id, case.status = user.id, "in_review"
            session.commit()
            return {"caseId": case.id}
    return {"caseId": None}


@router.get("/agents")
def list_agents(session: DbSession, _: CurrentUser, query: str = ""):
    agents = session.scalars(select(Agent).order_by(Agent.name)).all()
    return [out.agent_out(a) for a in agents if query.lower() in a.name.lower()]


# --- Caso -----------------------------------------------------------------------------


@router.get("/cases/{case_id}")
def case_detail(case_id: str, session: DbSession, user: CurrentUser, rubric: RubricDep):
    case = get_case(session, case_id)
    # Al abrir un caso de la cola, el auditor lo toma (igual que el mock): nadie más lo revisa en paralelo.
    if user.role == "auditor" and case.status in OPEN_STATUSES and case.locked_by_id is None:
        case.status, case.locked_by_id = "in_review", user.id
        session.commit()
    review = session.scalar(select(Review).where(Review.case_id == case.id))
    notes = session.scalars(select(Note).where(Note.case_id == case.id).order_by(Note.created_at)).all()
    prompts = {p.version: p for p in session.scalars(select(PromptVersion)).all()}
    return out.case_detail(case, rubric, user, review, list(notes), prompts)


class ItemReviewIn(BaseModel):
    criterionId: int  # noqa: N815
    action: Literal["confirmed", "corrected", "accepted_unchanged", "added"]
    verdict: Verdict
    correctionReason: str | None = None  # noqa: N815
    comment: str | None = None
    atMs: int | None = None  # noqa: N815


class ReviewIn(BaseModel):
    items: list[ItemReviewIn]
    badTranscriptTurns: list[int] = []  # noqa: N815
    reviewSeconds: int = 0  # noqa: N815


def final_verdict(items: list[ItemReviewIn]) -> CallVerdict:
    verdicts = {i.verdict for i in items}
    if "non_compliant" in verdicts:
        return "non_compliant"
    return "uncertain" if "uncertain" in verdicts else "compliant"


@router.post("/cases/{case_id}/review", status_code=204)
def submit_review(case_id: str, body: ReviewIn, session: DbSession, user: CurrentUser, rubric: RubricDep) -> None:
    case = get_case(session, case_id)
    if case.status not in OPEN_STATUSES:
        raise HTTPException(409, "El caso ya tiene una revisión enviada")
    review = session.scalar(select(Review).where(Review.case_id == case.id)) or Review(case_id=case.id)
    review.auditor_id = user.id
    review.items = [i.model_dump(exclude_none=True) for i in body.items]
    review.bad_transcript_turns = body.badTranscriptTurns
    review.final_verdict = final_verdict(body.items)
    review.review_seconds = body.reviewSeconds
    review.submitted_at = datetime.now(UTC)
    review.approved_at = None
    session.add(review)
    case.status, case.locked_by_id = "awaiting_approval", None
    for item in body.items:
        if (
            item.verdict == "non_compliant"
            and item.criterionId in rubric.criteria
            and rubric.is_critical(item.criterionId)
        ):
            session.add(
                Alert(
                    kind="critical_confirmed",
                    case_id=case.id,
                    criterion_id=item.criterionId,
                    at_ms=item.atMs,
                    reason=rubric.criteria[item.criterionId].description,
                    raised_by_id=user.id,
                )
            )
    session.commit()


class EscalateIn(BaseModel):
    reason: str
    comment: str = ""
    criterionId: int | None = None  # noqa: N815
    atMs: int | None = None  # noqa: N815


@router.post("/cases/{case_id}/escalate", status_code=204)
def escalate_case(case_id: str, body: EscalateIn, session: DbSession, user: CurrentUser) -> None:
    case = get_case(session, case_id)
    session.add(
        Alert(
            kind="escalation",
            case_id=case.id,
            criterion_id=body.criterionId,
            at_ms=body.atMs,
            reason=body.reason,
            comment=body.comment or None,
            raised_by_id=user.id,
        )
    )
    case.status, case.locked_by_id = "escalated", None
    session.commit()


@router.get("/my-reviews")
def my_reviews(session: DbSession, user: CurrentUser):
    rows = []
    for r in session.scalars(select(Review).where(Review.auditor_id == user.id)):
        case = session.get(Case, r.case_id)
        note = ""
        if case.status == "reopened":
            reopen = session.scalar(
                select(Note)
                .where(Note.case_id == case.id, Note.text.startswith(REOPEN_PREFIX))
                .order_by(Note.created_at.desc())
            )
            if reopen:
                note = f"{reopen.author.name} reabrió este caso: «{reopen.text.removeprefix(REOPEN_PREFIX)}»"
        rows.append(
            {
                "caseId": r.case_id,
                "callId": case.call_id,
                "submittedAt": out.iso(r.submitted_at),
                "status": case.status,
                "myVerdict": r.final_verdict,
                "note": note,
            }
        )
    escalated = session.scalars(
        select(Alert).where(Alert.raised_by_id == user.id, Alert.kind == "escalation", Alert.status != "handled")
    )
    for a in escalated:
        if a.case.status == "escalated" and all(row["caseId"] != a.case_id for row in rows):
            rows.append(
                {
                    "caseId": a.case_id,
                    "callId": a.case.call_id,
                    "submittedAt": out.iso(a.created_at),
                    "status": "escalated",
                    "myVerdict": None,
                    "note": "Esperando respuesta del supervisor",
                }
            )
    # Reabiertos primero; después lo más reciente.
    rows.sort(key=lambda row: row["submittedAt"], reverse=True)
    rows.sort(key=lambda row: row["status"] != "reopened")
    return rows


@router.get("/stats/day")
def day_stats(session: DbSession, user: CurrentUser):
    reviews = session.scalars(
        select(Review).where(Review.auditor_id == user.id, Review.submitted_at >= start_of_today())
    ).all()
    corrected = sum(any(i["action"] in ("corrected", "added") for i in r.items) for r in reviews)
    audio = sum(session.get(Case, r.case_id).duration_ms for r in reviews) // 1000
    return {
        "reviewed": len(reviews),
        "corrected": corrected,
        "reviewSeconds": sum(r.review_seconds for r in reviews),
        "audioSeconds": audio,
    }


# --- Notas ----------------------------------------------------------------------------


class NoteIn(BaseModel):
    scope: Literal["case", "finding"]
    criterionId: int | None = None  # noqa: N815
    text: str


@router.post("/cases/{case_id}/notes")
def add_note(case_id: str, body: NoteIn, session: DbSession, user: CurrentUser):
    case = get_case(session, case_id)
    if body.scope == "finding" and body.criterionId is None:
        raise HTTPException(422, "Una nota de motivo necesita criterionId")
    note = Note(
        case_id=case.id, scope=body.scope, criterion_id=body.criterionId, text=body.text.strip(), author_id=user.id
    )
    session.add(note)
    session.commit()
    session.refresh(note)
    return out.note_out(note)


class NoteEditIn(BaseModel):
    text: str


@router.patch("/notes/{note_id}")
def edit_note(note_id: str, body: NoteEditIn, session: DbSession, user: CurrentUser):
    note = session.get(Note, note_id)
    if note is None:
        raise HTTPException(404, "Nota no encontrada")
    if note.author_id != user.id:
        raise HTTPException(403, "Solo el autor puede editar su nota")
    note.text, note.edited_at = body.text.strip(), datetime.now(UTC)
    session.commit()
    return out.note_out(note)
