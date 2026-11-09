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

    def __call__(self, cfg: dict, system: str, user: str) -> tuple[str, float]:
        self.users.append(user)
        if self.first_bad and len(self.users) == 1:
            return "No pude armar el JSON", 0.01
        return json.dumps(PATTERN, ensure_ascii=False), 0.02


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
    assert observation["observationText"] == "Una llamada corta."
    accepted_obs = client.post(obs_url, json={"decision": "accepted", "text": "Calibrar llamadas cortas."}).json()
    assert accepted_obs["status"] == "accepted"
    assert accepted_obs["proposal"] == {
        "type": "calibrate_auditor",
        "action": None,
        "find": None,
        "text": "Una llamada corta.",
        "editedText": "Calibrar llamadas cortas.",
    }
    follow_url = f"/api/admin/discrepancies/patterns/{observation['id']}/follow-up"
    conflict = client.post(follow_url, json={"status": "asked_client"})
    assert (conflict.status_code, conflict.json()["detail"]) == (409, "observation_status")
    assert client.post(obs_url, json={"decision": "pending"}).json()["proposal"] is None
    accepted = client.post(url, json={"decision": "accepted", "text": "Exigir el guion completo."}).json()
    assert accepted["status"] == "accepted" and accepted["proposal"]["editedText"] == "Exigir el guion completo."
    assert [p["id"] for p in client.get("/api/admin/discrepancies/follow-up").json()] == [pattern["id"]]

    # Versión desde Seguimiento (Cambio 18): la regla (texto libre, anterior a la v1.3.0) se agrega al criterio del
    # motivo, la propuesta queda incluida y, si el borrador se descarta, vuelve a aceptada.
    ids = {"proposalIds": [pattern["id"]]}
    preview = client.post("/api/admin/prompts/from-follow-up/preview", json=ids).json()
    (motive,) = preview["criteria"]
    assert motive["criterionId"] == 30 and motive["after"].endswith("Exigir el guion completo.")
    assert [r["state"] for r in motive["rules"]] == ["free_text"]
    body = ids | {"baseVersion": preview["baseVersion"], "model": MODEL, "changelog": preview["changelog"]}
    created = client.post("/api/admin/prompts/from-follow-up", json=body)
    assert created.status_code == 200, created.text
    new = created.json()["version"]
    assert new == preview["version"]
    content = client.get(f"/api/admin/prompts/{new}").json()["content"]
    assert "Exigir el guion completo." in content and "origin: discrepancy_analysis" in content
    included = client.get(f"/api/admin/discrepancies/patterns/{pattern['id']}").json()
    assert included["status"] == "included" and included["decision"]["includedInVersion"] == new
    assert included["decision"]["versionStatus"] == "draft"
    # Ya incluida: no se puede volver a crear una versión con ella.
    assert client.post("/api/admin/prompts/from-follow-up", json=body).status_code == 409
    assert client.post(f"/api/admin/prompts/{new}/discard").status_code == 204
    assert client.get(f"/api/admin/discrepancies/patterns/{pattern['id']}").json()["status"] == "accepted"

    actions = {a["action"] for a in client.get("/api/admin/activity").json()}
    assert {"discrepancy_analysis_started", "proposal_accepted"} <= actions


def test_discard_observations_in_bulk(client: TestClient, admin: User, imported: sessionmaker[Session]) -> None:
    login(client, admin)
    data = run(client, imported, FakeModel())
    pattern, observation = data["patterns"]
    url = "/api/admin/discrepancies/observations/discard"
    reason = "La evidencia no alcanza"

    assert client.post(url, json={"ids": [observation["id"]], "reason": " "}).json()["detail"] == "reason_required"
    assert client.post(url, json={"ids": [], "reason": reason}).json()["detail"] == "no_ids"
    assert client.post(url, json={"ids": ["no-existe"], "reason": reason}).status_code == 404
    mixed = client.post(url, json={"ids": [pattern["id"], observation["id"]], "reason": reason})
    assert (mixed.status_code, mixed.json()["detail"]) == (409, "not_observation")

    done = client.post(url, json={"ids": [observation["id"]], "reason": reason}).json()
    assert [(p["status"], p["decision"]["reason"]) for p in done] == [("discarded", reason)]
    activity = client.get("/api/admin/activity").json()
    assert "observations_discarded" in {a["action"] for a in activity}

    # Otro análisis recibe el descarte con el texto de la observación.
    model = FakeModel()
    run(client, imported, model)
    assert "Una llamada corta." in model.users[0] and reason in model.users[0]


def test_accepted_observation_never_reaches_the_prompt(
    client: TestClient, admin: User, imported: sessionmaker[Session]
) -> None:
    """Un patrón con menos de 3 casos es observación aunque guarde una propuesta de regla (D-94)."""
    login(client, admin)
    short = {**PATTERN["patterns"][0], "cases": ["1001"]}

    class ShortPattern(FakeModel):
        def __call__(self, cfg: dict, system: str, user: str) -> tuple[str, float]:
            return json.dumps({**PATTERN, "patterns": [short], "observations": []}, ensure_ascii=False), 0.02

    (observation,) = run(client, imported, ShortPattern())["patterns"]
    assert observation["isObservation"] and observation["observationText"] == "Exigir el guion de cierre completo."
    url = f"/api/admin/discrepancies/patterns/{observation['id']}/decision"
    assert client.post(url, json={"decision": "accepted"}).json()["proposal"]["type"] == "calibrate_auditor"
    preview = client.post("/api/admin/prompts/from-follow-up/preview", json={"proposalIds": [observation["id"]]})
    assert preview.status_code == 409


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


def test_gemini_falls_back_to_openrouter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sin saldo en Gemini, el mismo modelo por OpenRouter (campo fallback de models.toml), con su costo."""
    monkeypatch.setenv("GEMINI_API_KEY", "clave-ficticia")
    monkeypatch.setenv("OPENROUTER_API_KEY", "clave-ficticia")
    used = []

    def fake_call(cfg: dict, stem: str, system: str, user: str):
        used.append(cfg["name"])
        if cfg["provider"] == "gemini":
            raise RuntimeError("prepago sin saldo")
        return "{}", cfg["model"], {"input_tokens": 1_000_000, "output_tokens": 0}, 10

    monkeypatch.setattr(discrepancy_runs.bench, "call_with_retries", fake_call)
    monkeypatch.setattr(discrepancy_runs.bench, "load_dotenv", lambda path: None)
    cfg = discrepancy_runs.analysis.model_config("gemini-3-8-flash")
    text, cost = discrepancy_runs.bench_caller()(cfg, "system", "user")
    assert used == ["gemini-3-8-flash", "or-gemini-3-8-flash"] and text == "{}" and cost > 0


def test_big_criterion_runs_in_batches_and_merges(
    client: TestClient, admin: User, imported: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un motivo que no cabe en un pedido: una respuesta por tanda y la pasada que las junta, con el costo de todas."""
    login(client, admin)
    monkeypatch.setattr(discrepancy_runs.analysis, "BATCH_TOKENS", 1)
    estimate = client.post("/api/admin/discrepancies/estimate", json={"criteria": [30], "model": MODEL}).json()
    model = FakeModel()
    data = run(client, imported, model)
    assert len(model.users) == 4  # 3 casos, uno por tanda, y la pasada que junta
    assert "## Tanda 3 de 3" in model.users[3] and "Transcripción completa" not in model.users[3]
    assert data["analysis"]["status"] == "done" and data["analysis"]["costUsd"] == pytest.approx(0.08)
    assert estimate["cases"] == 3


def test_pattern_without_proposal_has_nothing_to_accept(
    client: TestClient, admin: User, imported: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Desde la v1.2.0 un patrón sin cambio de prompt ni calibración del auditor viene con "proposal": null."""
    login(client, admin)
    pattern = PATTERN["patterns"][0] | {"cause": "missing_data", "proposal": None}
    monkeypatch.setitem(PATTERN, "patterns", [pattern])
    data = run(client, imported, FakeModel())
    assert data["analysis"]["status"] == "done"
    without, _ = data["patterns"]
    assert without["caseCount"] == 3 and without["isObservation"] and without["proposal"] is None


def test_summary_with_analysis_v1_0(client: TestClient, admin: User, imported: sessionmaker[Session]) -> None:
    """Cambio 19: con un análisis sin los campos de v1.1+ las cifras salen sin IA y lo demás queda en null."""
    login(client, admin)
    before = client.get("/api/admin/discrepancies").json()
    assert before["summary"]["analyzedCases"] == 0 and before["summary"]["criteriaNotAnalyzed"] is None
    data = run(client, imported, FakeModel())
    assert data["analysis"]["capabilities"] == dict.fromkeys(
        ("whoIsRight", "expectedFix", "sideEffects", "concentration", "tentative"), False
    )
    pattern, _ = data["patterns"]
    assert pattern["kindCounts"] == {"fp": 1, "fn": 2, "uncertain": 0}
    assert [pattern[k] for k in ("whoIsRight", "expectedFix", "sideEffects", "concentration", "tentative")] == [
        None
    ] * 5
    summary = data["summary"]
    # Los 3 casos del motivo 30 están en el patrón; 1002 también en la observación, pero cuenta una vez.
    assert summary["analyzedCases"] == 3 and summary["explainedCases"] == 3
    assert summary["byAction"] == {
        "prompt_rule": 3,
        "calibrate_auditor": 0,
        "company": 0,
        "none": 0,
        "observation": 0,
        "unpatterned": 0,
    }
    assert summary["byWhoIsRight"] is None
    assert (summary["pendingProposals"], summary["pendingCases"], summary["staleCases"]) == (1, 3, 0)
    row = next(c for c in data["criteria"] if c["criterionId"] == 30)
    assert row["explained"] == {"fp": 1, "fn": 2, "uncertain": 0} and row["analyzedCases"] == 3
    assert all(c["explained"] is None for c in data["criteria"] if c["criterionId"] != 30)
    assert data["followUp"] == {"accepted": 0, "resolved": 0, "discarded": 0}
    detail = client.get(f"/api/admin/discrepancies/patterns/{pattern['id']}").json()
    assert {c["expectedFix"] for c in detail["cases"]} == {None}

    url = f"/api/admin/discrepancies/patterns/{pattern['id']}/decision"
    client.post(url, json={"decision": "accepted"})
    after = client.get("/api/admin/discrepancies").json()
    assert after["followUp"] == {"accepted": 1, "resolved": 0, "discarded": 0}
    assert after["summary"]["pendingProposals"] == 0


def test_summary_with_analysis_v1_2(
    client: TestClient, admin: User, imported: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Con los campos de v1.1+: quién tiene más razón, lo que corregiría y los casos sin patrón."""
    login(client, admin)
    pattern = PATTERN["patterns"][0] | {
        "cause": "rule_text",
        "cases": ["1001", "1003", "1002"],
        "who_is_right": "auditor",
        "tentative": False,
        "concentration": "",
        "side_effects": "1004 podría cambiar.",
        "expected_fix": ["1001", "1003"],
        "proposal": {"type": "calibrate_auditor", "action": None, "find": None, "text": "Calibrar el cierre."},
    }
    monkeypatch.setitem(PATTERN, "patterns", [pattern])
    data = run(client, imported, FakeModel())
    assert all(data["analysis"]["capabilities"].values())
    out, _ = data["patterns"]
    assert out["whoIsRight"] == "auditor" and out["expectedFix"] == ["1001", "1003"]
    assert out["concentration"] is None and out["sideEffects"] == "1004 podría cambiar." and out["tentative"] is False
    summary = data["summary"]
    assert summary["byWhoIsRight"] == {"auditor": 3, "ia": 0, "ambiguo": 0, "unpatterned": 0}
    assert summary["byAction"]["calibrate_auditor"] == 3
    detail = client.get(f"/api/admin/discrepancies/patterns/{out['id']}").json()
    assert {c["callId"]: c["expectedFix"] for c in detail["cases"]} == {"1001": True, "1002": False, "1003": True}
