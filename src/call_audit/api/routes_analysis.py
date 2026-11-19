"""«Calidad del servicio» (docs/ux/vistas-supervisor/08-alta-fidelidad.md §4.2): solo lectura sobre la foto vigente.

Nunca consulta las corridas en vivo. Motivos (D-41, por ahora), evaluadores y los informes internos son solo para
Qubico: al supervisor le responden 404 (no 403), para no revelar que existen.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from call_audit.analysis import compute
from call_audit.analysis.snapshot import calls_of, current, last_processed_at
from call_audit.api.deps import DbSession, current_user
from call_audit.persistence.models import AccessLog, AnalysisReport, AnalysisSnapshot, User

router = APIRouter(prefix="/api/analysis")

QUBICO = ("qubico_admin", "qubico_viewer")


def analysis_reader(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role not in ("supervisor", *QUBICO):
        raise HTTPException(403, "Solo para supervisores y Qubico")
    return user


Reader = Annotated[User, Depends(analysis_reader)]
TypeQ = Annotated[str, Query(alias="type")]
FlowQ = Annotated[str, Query()]


def snapshot_or_404(session: DbSession) -> AnalysisSnapshot:
    snapshot = current(session)
    if snapshot is None:
        raise HTTPException(404, "no_snapshot")
    return snapshot


Snapshot = Annotated[AnalysisSnapshot, Depends(snapshot_or_404)]


def config_of(snapshot: AnalysisSnapshot) -> compute.Config:
    return compute.Config.from_dict(snapshot.config or {})


def blocks_of(snapshot: AnalysisSnapshot) -> dict[int, str]:
    return {int(k): v for k, v in (snapshot.payload.get("blocks") or {}).items()}


def periods(snapshot: AnalysisSnapshot) -> list[dict[str, str]]:
    return compute.periods_of(snapshot.period_to, (snapshot.config or {}).get("periodDays", 90))


def scoped(session: DbSession, snapshot: AnalysisSnapshot, insurance_type: str, flow: str) -> list[compute.Call]:
    return compute.filtered(calls_of(session, snapshot), insurance_type or compute.ALL, flow or compute.ALL)


def only_qubico(user: User) -> None:
    if user.role not in QUBICO:
        raise HTTPException(404, "not_found")


@router.get("/snapshot")
def snapshot_meta(session: DbSession, _: Reader):
    snapshot = current(session)
    if snapshot is None:
        raise HTTPException(404, detail="no_snapshot", headers={"X-Last-Processed": last_processed_at(session) or ""})
    config = snapshot.config or {}
    return {
        "id": snapshot.id,
        "createdAt": snapshot.created_at.isoformat(),
        "periodFrom": snapshot.period_from,
        "periodTo": snapshot.period_to,
        "periodDays": config.get("periodDays", 90),
        "periods": periods(snapshot),
        "sheetUntil": snapshot.sheet_until,
        # D-31: cuántas llamadas toman la referencia de una revisión del auditor y cuántas de la planilla.
        "reference": snapshot.payload.get("reference") or {"auditor": 0, "sheet": 0},
        "runs": snapshot.runs,
        "lastProcessedAt": last_processed_at(session),
        "filters": snapshot.payload.get("filters") or {"insuranceTypes": [], "flows": []},
        "config": {k: config.get(k) for k in ("u", "equal", "low", "minAgents", "pageSize", "topCriteria")},
    }


@router.get("/status")
def status(session: DbSession, _: Reader):
    """Para el estado S-01: cuándo se procesó la última pasada aunque todavía no haya foto."""
    return {"hasSnapshot": current(session) is not None, "lastProcessedAt": last_processed_at(session)}


@router.get("/criteria")
def criteria(snapshot: Snapshot, user: Reader, type: TypeQ = "", flow: FlowQ = ""):  # noqa: A002
    only_qubico(user)  # D-41: Motivos, por ahora, solo para Qubico.
    key = f"{type or compute.ALL}|{flow or compute.ALL}"
    rows = (snapshot.payload.get("criteria") or {}).get(key)
    if rows is None:
        return []  # combinación sin llamadas (S-03)
    return rows


@router.get("/criteria/{criterion_id}")
def criterion(
    criterion_id: int,
    session: DbSession,
    snapshot: Snapshot,
    user: Reader,
    type: TypeQ = "",
    flow: FlowQ = "",  # noqa: A002
):
    only_qubico(user)
    if criterion_id not in compute.CRITERIA:
        raise HTTPException(404, "not_found")
    calls = scoped(session, snapshot, type, flow)
    return compute.criterion_detail(calls, criterion_id, blocks_of(snapshot), config_of(snapshot))


@router.get("/agents")
def agents(
    session: DbSession,
    snapshot: Snapshot,
    _: Reader,
    type: TypeQ = "",  # noqa: A002
    flow: FlowQ = "",
    criterion: int | None = None,
    page: int = 1,
):
    config = config_of(snapshot)
    calls = scoped(session, snapshot, type, flow)
    rows = compute.agent_rows(calls, criterion, config)
    start = (max(page, 1) - 1) * config.page_size
    return {
        "gate": compute.agents_gate(calls, config),
        "rows": rows[start : start + config.page_size],
        "total": len(rows),
        "page": max(page, 1),
        "pageSize": config.page_size,
        "team": compute.agents_team(calls, criterion, config),
    }


@router.get("/agents/matrix")
def agents_matrix(
    session: DbSession,
    snapshot: Snapshot,
    _: Reader,
    type: TypeQ = "",  # noqa: A002
    flow: FlowQ = "",
    page: int = 1,
):
    calls = scoped(session, snapshot, type, flow)
    return compute.agent_matrix(calls, blocks_of(snapshot), config_of(snapshot), page)


@router.get("/agents/{agent_id}")
def agent(
    agent_id: str,
    session: DbSession,
    snapshot: Snapshot,
    user: Reader,
    type: TypeQ = "",  # noqa: A002
    flow: FlowQ = "",
    all: bool = False,  # noqa: A002
):
    calls = scoped(session, snapshot, type, flow)
    detail = compute.agent_detail(calls, agent_id, config_of(snapshot), all, periods(snapshot))
    if detail is None:
        raise HTTPException(404, "not_found")
    # Acceso a datos de un ejecutivo: queda en el registro de actividad (D-13).
    session.add(AccessLog(user_id=user.id, action="analysis_agent_view", target=agent_id))
    session.commit()
    return detail


@router.get("/evaluators")
def evaluators(session: DbSession, snapshot: Snapshot, user: Reader, type: TypeQ = "", flow: FlowQ = ""):  # noqa: A002
    only_qubico(user)
    return compute.evaluator_rows(scoped(session, snapshot, type, flow), config_of(snapshot))


@router.get("/evaluators/matrix")
def evaluators_matrix(session: DbSession, snapshot: Snapshot, user: Reader, type: TypeQ = "", flow: FlowQ = ""):  # noqa: A002
    only_qubico(user)
    return compute.evaluator_matrix(scoped(session, snapshot, type, flow), blocks_of(snapshot), config_of(snapshot))


@router.get("/evaluators/{name}")
def evaluator(
    name: str,
    session: DbSession,
    snapshot: Snapshot,
    user: Reader,
    type: TypeQ = "",
    flow: FlowQ = "",  # noqa: A002
):
    only_qubico(user)
    calls = scoped(session, snapshot, type, flow)
    detail = compute.evaluator_detail(calls, name, config_of(snapshot), periods(snapshot))
    if detail is None:
        raise HTTPException(404, "not_found")
    return detail


def report_meta(r: AnalysisReport) -> dict:
    return {"slug": r.slug, "title": r.title, "date": r.date, "run": r.run, "audience": r.audience}


def visible_reports(session: DbSession, user: User):
    query = select(AnalysisReport).order_by(AnalysisReport.date.desc(), AnalysisReport.slug)
    if user.role not in QUBICO:
        query = query.where(AnalysisReport.audience == "company")
    return session.scalars(query)


@router.get("/reports")
def reports(session: DbSession, user: Reader):
    return [report_meta(r) for r in visible_reports(session, user)]


@router.get("/reports/{slug}")
def report(slug: str, session: DbSession, user: Reader):
    found = session.get(AnalysisReport, slug)
    if found is None or (found.audience != "company" and user.role not in QUBICO):
        raise HTTPException(404, "not_found")
    return {**report_meta(found), "bodyMd": found.body_md}


@router.get("/calls")
def calls(
    session: DbSession,
    snapshot: Snapshot,
    user: Reader,
    type: TypeQ = "",  # noqa: A002
    flow: FlowQ = "",
    criterion: int | None = None,
    source: Literal["ai", "sheet", "mismatch"] = "ai",
    agent: str | None = None,
    evaluator: str | None = None,
    page: int = 1,
):
    if evaluator:
        only_qubico(user)
    config = config_of(snapshot)
    return compute.calls_page(
        scoped(session, snapshot, type, flow),
        cid=criterion,
        source=source,
        agent_id=agent,
        evaluator=evaluator,
        page=page,
        page_size=config.page_size,
    )
