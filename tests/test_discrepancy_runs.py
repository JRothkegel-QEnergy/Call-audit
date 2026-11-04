"""Análisis de discrepancias en la app (Cambio 16): estimar, lanzar, correr en el worker con un modelo doble, decidir
las propuestas y llevarlas a una versión del prompt. Todo sintético."""

import json

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import discrepancy_runs
from call_audit.persistence.models import Case, Review, User
from tests.conftest import PASSWORD, login

MODEL = "claude-sonnet-5-5"
# Motivos que el cliente marcó NO CUMPLE por llamada. Con la corrida del fixture, en el motivo 30 queda:
# 1002 fp (la IA marca y el cliente no), 1001 y 1003 fn (el cliente marca y la IA no).
CLIENT_FAILS = {"1001": [30], "1002": [], "1003": [12, 30]}
PATTERN = {
    "criterion_id": 30,
    "summary": "La IA y el cliente no leen igual el cierre.",
    "patterns": [
        {
            "title": "El cierre se da por bueno sin el guion completo",
            "direction": "fn",
            "cause": "criterion",
            "cases": ["1001", "1003", "1002"],
            "explanation": "Sintético.",
            "quotes": [
                {"call_id": "1001", "text": "Quiero renunciar al seguro."},
                {"call_id": "1001", "text": "una frase que nadie dijo"},
            ],
            "proposal": {"type": "prompt_rule", "text": "Exigir el guion de cierre completo."},
            "confidence": 0.8,
        }
    ],
    "observations": [{"cases": ["1002"], "text": "Una llamada corta."}],
    "unexplained_cases": [],
}


@pytest.fixture
def admin(imported: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch) -> User:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "clave-ficticia")
    user = User(
        email="admin@qubico-ejemplo.cl",
        name="Admin",
        role="qubico_admin",
        permissions=[],
        password_hash=PasswordHasher().hash(PASSWORD),
    )
    with imported() as session, session.begin():
        session.add(user)
        for case in session.scalars(select(Case)):
            case.external_item_fails = CLIENT_FAILS[case.call_id]
    return user


class FakeModel:
    """Primero responde sin JSON (el worker reintenta una vez) y después el patrón."""

    def __init__(self, first_bad: bool = False) -> None:
        self.users: list[str] = []
        self.first_bad = first_bad

    def __call__(self, cfg: dict, system: str, user: str) -> tuple[str, dict]:
        self.users.append(user)
        usage = {"input_tokens": 10_000, "output_tokens": 2_000}
        if self.first_bad and len(self.users) == 1:
            return "No pude armar el JSON", usage
        return json.dumps(PATTERN, ensure_ascii=False), usage


def run(client: TestClient, imported: sessionmaker[Session], model: FakeModel) -> dict:
    started = client.post("/api/admin/discrepancies/analyses", json={"criteria": [30], "model": MODEL, "confirm": True})
    assert started.status_code == 200, started.text
    discrepancy_runs.process_pending(imported, caller=model)
    return client.get("/api/admin/discrepancies").json()


def test_only_admin(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["supervisor"])
    assert client.get("/api/admin/discrepancies").status_code == 403


def test_analysis_flow(client: TestClient, admin: User, imported: sessionmaker[Session]) -> None:
    login(client, admin)
    before = client.get("/api/admin/discrepancies").json()
    row = next(c for c in before["criteria"] if c["criterionId"] == 30)
    assert (row["fp"], row["fn"], row["patterns"]) == (1, 2, None)
    assert before["analysis"] is None and before["calls"] == 3

    estimate = client.post("/api/admin/discrepancies/estimate", json={"criteria": [30], "model": MODEL}).json()
    assert estimate["cases"] == 3 and estimate["totalUsd"] > 0
    body = {"criteria": [30], "model": MODEL}
    assert client.post("/api/admin/discrepancies/analyses", json=body).status_code == 422
    assert client.post("/api/admin/discrepancies/analyses", json=body | {"confirm": True}).status_code == 200
    assert client.post("/api/admin/discrepancies/analyses", json=body | {"confirm": True}).status_code == 409
    task = client.get("/api/admin/processing").json()["otherTasks"]["discrepancyAnalysis"]
    assert task["total"] == 1 and task["done"] == 0

    model = FakeModel(first_bad=True)
    discrepancy_runs.process_pending(imported, caller=model)
    assert len(model.users) == 2  # reintentó una vez
    data = client.get("/api/admin/discrepancies").json()
    assert data["analysis"]["status"] == "done" and data["analysis"]["costUsd"] > 0
    assert data["running"] is None and data["stale"] is None
    assert next(c for c in data["criteria"] if c["criterionId"] == 30)["patterns"] == 1
    pattern, observation = data["patterns"]
    assert pattern["caseCount"] == 3 and not pattern["isObservation"] and pattern["rank"] == 1
    assert [q["validated"] for q in pattern["quotes"]] == [True, False]
    assert observation["isObservation"] and observation["proposal"] is None

    detail = client.get(f"/api/admin/discrepancies/patterns/{pattern['id']}").json()
    assert {c["callId"]: c["kind"] for c in detail["cases"]} == {"1001": "fn", "1002": "fp", "1003": "fn"}
    quality = client.get("/api/admin/quality").json()
    assert quality["currentSeriesPatternCounts"] == {"30": 1}

    url = f"/api/admin/discrepancies/patterns/{pattern['id']}/decision"
    assert client.post(url, json={"decision": "discarded"}).status_code == 422
    obs_url = f"/api/admin/discrepancies/patterns/{observation['id']}/decision"
    assert client.post(obs_url, json={"decision": "accepted"}).status_code == 409
    accepted = client.post(url, json={"decision": "accepted", "text": "Exigir el guion completo."}).json()
    assert accepted["status"] == "accepted" and accepted["proposal"]["editedText"] == "Exigir el guion completo."
    assert [p["id"] for p in client.get("/api/admin/discrepancies/follow-up").json()] == [pattern["id"]]

    # Al guardar una versión con la propuesta queda incluida; si la versión se descarta, vuelve a aceptada.
    active = next(v for v in client.get("/api/admin/prompts").json() if v["status"] == "active")
    major, minor = active["version"].split(".")
    new = f"{major}.{int(minor) + 1}"
    created = client.post(
        "/api/admin/prompts",
        json={
            "source": "text",
            "content": "Eres un auditor sintético.",
            "version": new,
            "model": MODEL,
            "changelog": "Cierre",
            "includedProposalIds": [pattern["id"]],
        },
    )
    assert created.status_code == 200, created.text
    included = client.get(f"/api/admin/discrepancies/patterns/{pattern['id']}").json()
    assert included["status"] == "included" and included["decision"]["includedInVersion"] == new
    assert included["decision"]["versionStatus"] == "draft"
    assert client.post(f"/api/admin/prompts/{new}/discard").status_code == 204
    assert client.get(f"/api/admin/discrepancies/patterns/{pattern['id']}").json()["status"] == "accepted"

    actions = {a["action"] for a in client.get("/api/admin/activity").json()}
    assert {"discrepancy_analysis_started", "proposal_accepted"} <= actions


def test_discarded_proposals_go_to_the_next_analysis(
    client: TestClient, admin: User, imported: sessionmaker[Session]
) -> None:
    login(client, admin)
    first = run(client, imported, FakeModel())
    pattern = first["patterns"][0]
    discard = {"decision": "discarded", "reason": "La evidencia no alcanza"}
    assert client.post(f"/api/admin/discrepancies/patterns/{pattern['id']}/decision", json=discard).status_code == 200

    model = FakeModel()
    second = run(client, imported, model)
    assert "Propuestas ya descartadas" in model.users[0] and "La evidencia no alcanza" in model.users[0]
    assert second["analysis"]["id"] != first["analysis"]["id"]
    # El análisis anterior se abre en solo lectura y conserva la decisión.
    old = client.get(f"/api/admin/discrepancies?analysis={first['analysis']['id']}").json()
    assert old["readOnly"] and old["patterns"][0]["status"] == "discarded"
    assert len(client.get("/api/admin/discrepancies/analyses").json()) == 2


def test_stop_and_stale(client: TestClient, admin: User, imported: sessionmaker[Session]) -> None:
    login(client, admin)
    started = client.post(
        "/api/admin/discrepancies/analyses", json={"criteria": [12, 30], "model": MODEL, "confirm": True}
    ).json()
    assert client.post(f"/api/admin/discrepancies/analyses/{started['id']}/stop").status_code == 204
    model = FakeModel()
    discrepancy_runs.process_pending(imported, caller=model)
    assert model.users == []
    history = client.get("/api/admin/discrepancies/analyses").json()
    assert history[0]["status"] == "stopped" and history[0]["stoppedBy"] == "Admin"

    run(client, imported, FakeModel())
    with imported() as session, session.begin():
        case = session.scalar(select(Case).where(Case.call_id == "1002"))
        session.add(Review(case_id=case.id, auditor_id=admin.id, items=[], final_verdict="compliant"))
    stale = client.get("/api/admin/discrepancies").json()["stale"]
    assert stale == {"currentSeriesChanged": False, "currentSeries": None, "newReviews": 1}
