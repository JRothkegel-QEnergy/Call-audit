"""Calidad del servicio: cálculos de la foto y API de solo lectura (docs/ux/vistas-supervisor/08-alta-fidelidad.md)."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit.analysis import compute
from call_audit.analysis.snapshot import build, parse_report
from call_audit.persistence.models import AnalysisSnapshot, Case, User
from tests.conftest import login


def call(n: int, agent: str = "A", evaluator: str | None = "Eva", ai=(), sheet=(), itype="Vida", evidence=None):
    return compute.Call(
        case_id=f"c{n}",
        call_id=str(n),
        call_date=f"2026-10-{n % 28 + 1:02d}",
        agent_id=agent,
        agent_name=f"Ejecutivo {agent}",
        evaluator=evaluator,
        insurance_type=itype,
        flow="Entrante",
        ai_fails=frozenset(ai),
        sheet_fails=None if sheet is None else frozenset(sheet),
        ai_evidence_ms=evidence or {},
        ai_verdict="non_compliant" if ai else "compliant",
        sheet_verdict=None if sheet is None else ("non_compliant" if sheet else "compliant"),
    )


def test_mismatch_shows_disagreement_that_the_gap_hides() -> None:
    # HE-01: la IA y la planilla marcan el motivo 18 en la misma proporción, pero en llamadas distintas.
    calls = [call(1, ai=[18]), call(2, sheet=[18]), call(3), call(4)]
    numbers = compute.criterion_numbers(calls, 18)
    assert numbers["aiPct"] == numbers["sheetPct"] == 25.0
    assert numbers["gapPts"] == 0.0
    assert numbers["mismatchPct"] == 50.0
    assert numbers["mismatchCalls"] == 2


def test_sheet_base_is_only_evaluated_calls() -> None:
    calls = [call(1, ai=[3], sheet=[3]), call(2, sheet=None), call(3, sheet=None), call(4, sheet=[])]
    numbers = compute.criterion_numbers(calls, 3)
    assert numbers["base"] == {"withRun": 4, "evaluated": 2}
    assert numbers["aiPct"] == 25.0
    assert numbers["sheetPct"] == 50.0


def test_status_needs_most_evaluators_over_the_threshold() -> None:
    config = compute.Config(low=2, data_explained={25: "nota"})
    # Eva discrepa en 1 de 2 (50 %), Ana en 0 de 2: solo una de dos → no es mayoría.
    calls = [
        call(1, evaluator="Eva", ai=[7]),
        call(2, evaluator="Eva"),
        call(3, evaluator="Ana"),
        call(4, evaluator="Ana"),
    ]
    numbers = compute.criterion_numbers(calls, 7)
    assert compute.criterion_status(calls, 7, numbers, config) == "consistent"
    calls.append(call(5, evaluator="Ana", sheet=[7]))
    numbers = compute.criterion_numbers(calls, 7)
    assert compute.criterion_status(calls, 7, numbers, config) == "divergent"
    assert compute.criterion_status(calls, 25, compute.criterion_numbers(calls, 25), config) == "data_explained"
    no_sheet = [call(9, sheet=None)]
    assert compute.criterion_status(no_sheet, 7, compute.criterion_numbers(no_sheet, 7), config) == "na"


def test_agents_gate_and_deviation_against_team() -> None:
    config = compute.Config(low=2, min_agents=2)
    calls = [call(1, "A", ai=[4]), call(2, "A", ai=[4]), call(3, "B"), call(4, "B"), call(5, "C")]
    gate = compute.agents_gate(calls, config)
    assert gate == {"open": True, "agentsWithEnough": 2, "totalAgents": 3}
    rows = compute.agent_rows(calls, 4, config)
    assert [r["agentId"] for r in rows] == ["A", "B", "C"]  # «pocas llamadas» al final
    assert rows[0]["deviationPts"] == 60.0  # 100 % frente a 40 % del equipo
    assert rows[2]["lowSample"] is True
    assert compute.agents_gate(calls, compute.Config(low=3, min_agents=1))["open"] is False


def test_agent_detail_puts_data_explained_last_and_trims() -> None:
    config = compute.Config(top_criteria=3, data_explained={25: "nota"})
    calls = [call(1, "A", ai=[25, 1]), call(2, "B")]
    detail = compute.agent_detail(calls, "A", config, show_all=False)
    assert detail is not None
    assert len(detail["criteria"]) == 3 and detail["showingAll"] is False
    full = compute.agent_detail(calls, "A", config, show_all=True)
    assert full is not None and full["criteria"][-1]["criterionId"] == 25
    assert compute.agent_detail(calls, "Z", config, show_all=False) is None


def test_evaluator_severity_and_kappa() -> None:
    calls = [call(1, evaluator="Eva", sheet=[5, 6]), call(2, evaluator="Eva", ai=[5], sheet=[5])]
    rows = compute.evaluator_rows(calls, compute.Config(low=1))
    assert rows[0]["name"] == "Eva"
    assert rows[0]["severityPerCall"] == 1.0  # marca 2 motivos que la IA no, en 2 llamadas
    detail = compute.evaluator_detail(calls, "Eva")
    assert detail is not None
    by_id = {r["criterionId"]: r for r in detail["criteria"]}
    assert by_id[6]["severityPts"] == 50.0
    assert by_id[5]["disagreementPct"] == 50.0
    assert compute.kappa([(True, True), (False, False)]) == 1.0
    assert compute.kappa([(False, False)]) is None


def test_periods_are_three_spans_of_30_days_back_from_the_end() -> None:
    spans = compute.periods_of("2026-11-17", 90)
    assert [p["id"] for p in spans] == ["p1", "p2", "p3"]
    assert spans[2] == {"id": "p3", "from": "2026-10-19", "to": "2026-11-17"}
    assert spans[0]["from"] == "2026-08-20"
    assert compute.periods_of("2026-11-17", 45) == []


def test_evaluator_matrix_marks_criteria_most_auditors_disagree_on() -> None:
    config = compute.Config(low=2, u=15)
    # Eva y Ana no coinciden con la IA en el motivo 7 en la mitad de sus llamadas; Leo tiene pocas llamadas.
    calls = [
        call(1, evaluator="Eva", ai=[7]),
        call(2, evaluator="Eva"),
        call(3, evaluator="Ana", sheet=[7]),
        call(4, evaluator="Ana"),
        call(5, evaluator="Leo", ai=[3]),
    ]
    matrix = compute.evaluator_matrix(calls, {7: "C"}, config)
    by_id = {c["criterionId"]: c for c in matrix["criteria"]}
    assert by_id[7]["markedDifferent"] is True and by_id[7]["blockId"] == "C"
    assert by_id[3]["markedDifferent"] is False
    assert [r["name"] for r in matrix["rows"]][-1] == "Leo"  # «pocas llamadas» al final
    eva = next(r for r in matrix["rows"] if r["name"] == "Eva")
    assert len(eva["cells"]) == 33
    cell = next(c for c in eva["cells"] if c["criterionId"] == 7)
    assert cell["mismatchCalls"] == 1 and cell["disagreementPct"] == 50.0 and cell["severityPts"] == -50.0
    assert matrix["team"]["evaluated"] == 5


def test_evaluator_detail_compares_with_team_and_trend() -> None:
    calls = [call(1, evaluator="Eva", ai=[7]), call(2, evaluator="Ana"), call(3, evaluator="Ana")]
    periods = compute.periods_of("2026-10-28", 90)
    detail = compute.evaluator_detail(calls, "Eva", compute.Config(low=1), periods)
    assert detail is not None
    first = detail["criteria"][0]
    assert first["criterionId"] == 7
    assert first["mismatchCalls"] == 1 and first["evaluated"] == 1
    assert first["teamDisagreementPct"] == pytest.approx(33.3)
    assert [t["periodId"] for t in detail["trend"]] == ["p1", "p2", "p3"]
    assert detail["trend"][2]["evaluated"] == 1 and detail["trend"][2]["disagreementPerCall"] == 1.0


def test_agent_matrix_and_team_follow_the_gate() -> None:
    config = compute.Config(low=2, min_agents=2)
    calls = [call(1, "A", ai=[4]), call(2, "A", ai=[4]), call(3, "B"), call(4, "B"), call(5, "C")]
    matrix = compute.agent_matrix(calls, {}, config, page=1)
    assert [r["agentId"] for r in matrix["rows"]] == ["A", "B", "C"]
    cell = next(c for c in matrix["rows"][0]["cells"] if c["criterionId"] == 4)
    assert cell["deviationPts"] == 60.0
    assert next(c for c in matrix["criteria"] if c["criterionId"] == 4)["agentsOutside"] == 2
    closed = compute.agent_matrix(calls, {}, compute.Config(low=3, min_agents=1), page=1)
    assert closed["rows"] == [] and closed["gate"]["open"] is False
    team = compute.agents_team(calls, None, config)
    assert team["aiPct"] == 40.0 and team["agentsWithEnough"] == 2 and team["withinRange"] == 0
    detail = compute.agent_detail(calls, "A", config, show_all=False, periods=compute.periods_of("2026-10-28", 90))
    assert detail is not None and detail["trend"][2]["calls"] == 2 and detail["trend"][2]["aiPct"] == 100.0


def test_calls_page_filters_by_source_and_reports_evidence() -> None:
    calls = [call(1, ai=[9], sheet=[], evidence={9: 61000}), call(2, sheet=[9]), call(3, ai=[9], sheet=[9])]
    ai = compute.calls_page(calls, cid=9, source="ai", agent_id=None, evaluator=None, page=1, page_size=50)
    assert {r["callId"] for r in ai["rows"]} == {"1", "3"}
    mismatch = compute.calls_page(calls, cid=9, source="mismatch", agent_id=None, evaluator=None, page=1, page_size=50)
    assert {r["callId"] for r in mismatch["rows"]} == {"1", "2"}
    first = next(r for r in mismatch["rows"] if r["callId"] == "1")
    assert first["evidenceMs"] == 61000
    paged = compute.calls_page(calls, cid=None, source=None, agent_id=None, evaluator=None, page=2, page_size=2)
    assert paged["total"] == 3 and len(paged["rows"]) == 1


def test_parse_report_requires_header(tmp_path: Path) -> None:
    good = tmp_path / "patrones.md"
    good.write_text("---\ntitle: Patrones\ndate: 2026-11-17\naudience: company\n---\n# Hola\n", encoding="utf-8")
    assert parse_report(good)["slug"] == "patrones"
    bad = tmp_path / "malo.md"
    bad.write_text("---\ntitle: X\ndate: 2026-11-17\naudience: todos\n---\nx", encoding="utf-8")
    with pytest.raises(ValueError):
        parse_report(bad)
    (tmp_path / "sin.md").write_text("# Sin encabezado", encoding="utf-8")
    with pytest.raises(ValueError):
        parse_report(tmp_path / "sin.md")


@pytest.fixture
def snapshot_db(imported: sessionmaker[Session], tmp_path: Path) -> sessionmaker[Session]:
    reports = tmp_path / "reports"
    reports.mkdir()
    (reports / "publico.md").write_text(
        "---\ntitle: Patrones\ndate: 2026-11-17\nrun: v9.9\naudience: company\n---\nTexto", encoding="utf-8"
    )
    (reports / "interno.md").write_text(
        "---\ntitle: Interno\ndate: 2026-11-16\naudience: internal\n---\nSolo Qubico", encoding="utf-8"
    )
    with imported() as session, session.begin():
        for case in session.scalars(select(Case)):
            case.external_item_fails = [12] if case.call_id == "1003" else []
            case.call_metadata = {**(case.call_metadata or {}), "external_evaluator": "ANA.PEREZ"}
        assert build(session, reports_dir=reports) is not None
    return imported


@pytest.fixture
def qubico(snapshot_db: sessionmaker[Session]) -> User:
    from argon2 import PasswordHasher

    from tests.conftest import PASSWORD

    user = User(
        email="lectura@ejemplo.cl", name="Lectura", role="qubico_viewer", password_hash=PasswordHasher().hash(PASSWORD)
    )
    with snapshot_db() as session, session.begin():
        session.add(user)
    return user


def test_api_without_snapshot_is_404(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["supervisor"])
    assert client.get("/api/analysis/criteria").status_code == 404
    assert client.get("/api/analysis/status").json()["hasSnapshot"] is False


def test_api_roles_and_reads(client: TestClient, users: dict[str, User], snapshot_db, qubico: User) -> None:
    login(client, users["auditor"])
    assert client.get("/api/analysis/snapshot").status_code == 403

    login(client, users["supervisor"])
    meta = client.get("/api/analysis/snapshot").json()
    assert meta["runs"]["perCall"] == meta["runs"]["perCriterion"]
    # D-41: Motivos, por ahora, solo para Qubico.
    assert client.get("/api/analysis/criteria").status_code == 404
    assert client.get("/api/analysis/criteria/12").status_code == 404
    agents = client.get("/api/analysis/agents").json()
    assert agents["gate"]["open"] is False and agents["total"] >= 1
    assert client.get(f"/api/analysis/agents/{agents['rows'][0]['agentId']}").status_code == 200
    # Evaluadores e informes internos: 404 para el supervisor, sin revelar que existen.
    assert client.get("/api/analysis/evaluators").status_code == 404
    assert client.get("/api/analysis/evaluators/matrix").status_code == 404
    assert client.get("/api/analysis/calls", params={"evaluator": "Ana Perez"}).status_code == 404
    assert "team" in agents and "periods" in meta
    assert client.get("/api/analysis/agents/matrix").json()["rows"] == []  # Ejecutivos cerrado (D-27)
    assert [r["slug"] for r in client.get("/api/analysis/reports").json()] == ["publico"]
    assert client.get("/api/analysis/reports/interno").status_code == 404
    assert client.get("/api/analysis/reports/publico").json()["bodyMd"] == "Texto"
    page = client.get("/api/analysis/calls", params={"criterion": 12, "source": "sheet"}).json()
    assert page["total"] == 1

    login(client, qubico)
    rows = client.get("/api/analysis/criteria").json()
    assert len(rows) == 33
    m12 = next(r for r in rows if r["criterionId"] == 12)
    assert m12["sheetPct"] is not None and m12["base"]["evaluated"] == 3
    assert client.get("/api/analysis/criteria/12").json()["criterionId"] == 12
    assert client.get("/api/analysis/criteria/99").status_code == 404
    assert client.get("/api/analysis/criteria", params={"type": "No existe"}).json() == []
    evaluators = client.get("/api/analysis/evaluators").json()
    assert evaluators[0]["name"] == "Ana Perez"
    assert client.get("/api/analysis/evaluators/Ana Perez").json()["trend"] is not None
    assert client.get("/api/analysis/evaluators/matrix").json()["rows"][0]["name"] == "Ana Perez"
    assert len(client.get("/api/analysis/reports").json()) == 2


def test_new_snapshot_replaces_current(snapshot_db: sessionmaker[Session]) -> None:
    with snapshot_db() as session, session.begin():
        build(session)
    with snapshot_db() as session:
        snapshots = session.scalars(select(AnalysisSnapshot)).all()
        assert len(snapshots) == 2
        assert sum(s.is_current for s in snapshots) == 1


def test_auditor_review_wins_over_sheet(snapshot_db: sessionmaker[Session], users: dict[str, User]) -> None:
    """D-31: si un auditor revisó la llamada en la app, su revisión es la referencia; si no, la planilla."""
    from call_audit.analysis.snapshot import calls_of
    from call_audit.persistence.models import Review

    with snapshot_db() as session, session.begin():
        case = session.scalar(select(Case).where(Case.call_id == "1003"))  # planilla: motivo 12 No cumple
        session.add(
            Review(
                case_id=case.id,
                auditor_id=users["auditor"].id,
                items=[{"criterionId": 12, "action": "corrected", "verdict": "compliant"}],
                final_verdict="compliant",
            )
        )
    with snapshot_db() as session, session.begin():
        snapshot = build(session)
        assert snapshot is not None
        assert snapshot.payload["reference"] == {"auditor": 1, "sheet": 2}
        calls = {c.call_id: c for c in calls_of(session, snapshot)}
    reviewed = calls["1003"]
    assert reviewed.reference == "auditor"
    assert reviewed.sheet_fails == frozenset()  # el auditor corrigió el 12 a Cumple
    assert reviewed.evaluator == "Auditora" and reviewed.sheet_verdict == "compliant"
    assert {c.reference for k, c in calls.items() if k != "1003"} == {"sheet"}


def test_auditor_fails_keeps_ai_for_unreviewed_criteria() -> None:
    from call_audit.analysis.snapshot import auditor_fails
    from call_audit.persistence.models import Review

    review = Review(items=[{"criterionId": 3, "verdict": "compliant"}, {"criterionId": 9, "verdict": "non_compliant"}])
    assert auditor_fails(review, {3, 30}) == {30, 9}


def test_renunciation_reasons_come_from_the_prompt(client: TestClient, users: dict[str, User]) -> None:
    from call_audit.api.routes_reference import renunciation_reasons

    spec = {"sections": [{"items": [{"id": "renunciation_reasons", "text": "Uno | Dos |\n Tres"}]}]}
    assert renunciation_reasons(spec) == ["Uno", "Dos", "Tres"]
    assert client.get("/api/reference/renunciation-reasons").status_code == 401
    login(client, users["supervisor"])
    body = client.get("/api/reference/renunciation-reasons").json()
    assert body["reasons"][0] == "No desea contraer más obligaciones"
    assert body["reasons"][-1] == "No informado" and body["promptVersion"]
