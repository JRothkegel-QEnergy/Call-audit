from fastapi.testclient import TestClient

from call_audit.persistence.models import User
from tests.conftest import login


def case_id(client: TestClient, call_id: str) -> str:
    rows = client.get("/api/queue").json()["rows"]
    return next(r["id"] for r in rows if r["callId"] == call_id)


def test_requires_session(client: TestClient) -> None:
    assert client.get("/api/auth/me").json() is None
    assert client.get("/api/queue").status_code == 401


def test_rejects_wrong_password(client: TestClient, users: dict[str, User]) -> None:
    response = client.post("/api/auth/login", json={"email": users["auditor"].email, "password": "otra"})
    assert response.status_code == 401


def test_queue_puts_rejections_first(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["auditor"])
    rows = client.get("/api/queue").json()["rows"]
    assert [r["engineVerdict"] for r in rows] == ["non_compliant", "non_compliant", "compliant"]
    assert client.get("/api/queue", params={"engineVerdict": "compliant"}).json()["total"] == 1


def test_auditor_never_sees_client_verdict_or_model_io(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["auditor"])
    case = client.get(f"/api/cases/{case_id(client, '1002')}").json()
    assert case["externalQualityVerdict"] is None
    assert case["externalComment"] is None
    assert case["modelRuns"] == []
    assert {f["criterionId"] for f in case["findings"]} >= {1, 30}
    assert client.get("/api/discrepancies").status_code == 403


def test_model_io_permission_shows_prompt_and_raw_response(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["auditor_io"])
    case = client.get(f"/api/cases/{case_id(client, '1002')}").json()
    run = case["modelRuns"][0]
    assert run["promptSections"][0]["text"] == "Eres un auditor (sintético)."
    assert run["rawResponse"]["resumen"] == "Sintético"
    assert case["externalQualityVerdict"] is None


def test_supervisor_sees_client_verdict(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["supervisor"])
    case = client.get(f"/api/cases/{case_id(client, '1002')}").json()
    assert case["externalQualityVerdict"] == "compliant"
    assert "[TELEFONO]" in case["externalComment"]


def test_review_flow_until_approval(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["auditor"])
    next_id = client.post("/api/queue/next", json={}).json()["caseId"]
    assert client.get(f"/api/cases/{next_id}").json()["status"] == "in_review"
    items = [{"criterionId": 30, "action": "corrected", "verdict": "compliant", "correctionReason": "Otro"}]
    response = client.post(f"/api/cases/{next_id}/review", json={"items": items, "reviewSeconds": 300})
    assert response.status_code == 204
    assert client.post(f"/api/cases/{next_id}/review", json={"items": items}).status_code == 409
    mine = client.get("/api/my-reviews").json()
    assert mine[0]["myVerdict"] == "compliant" and mine[0]["status"] == "awaiting_approval"
    assert client.get("/api/stats/day").json()["corrected"] == 1

    login(client, users["supervisor"])
    pending = client.get("/api/approvals").json()
    assert [p["caseId"] for p in pending] == [next_id]
    assert "corrected_ai" in pending[0]["flags"]
    assert client.post("/api/approvals", json={"caseIds": [next_id]}).status_code == 204
    assert client.get(f"/api/cases/{next_id}").json()["status"] == "closed"


def test_notes_by_finding_only_editable_by_author(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["auditor"])
    cid = case_id(client, "1002")
    note = client.post(
        f"/api/cases/{cid}/notes", json={"scope": "finding", "criterionId": 30, "text": " Revisar "}
    ).json()
    assert note["text"] == "Revisar" and note["authorRole"] == "auditor"
    assert client.post(f"/api/cases/{cid}/notes", json={"scope": "finding", "text": "x"}).status_code == 422
    login(client, users["supervisor"])
    assert client.patch(f"/api/notes/{note['id']}", json={"text": "otra"}).status_code == 403


def test_discrepancy_tree(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["supervisor"])
    rows = {r["callId"]: r for r in client.get("/api/discrepancies").json()}
    assert rows["1001"]["branch"] == "match"
    assert rows["1002"]["branch"] == "ai_only_fail"
    assert rows["1002"]["aiFailCriteria"] == [30]
    assert rows["1003"]["branch"] == "match"

    cid = rows["1002"]["caseId"]
    body = {"classification": "ai_correct", "criterionIds": [30], "note": "Bien rechazada"}
    assert client.post(f"/api/discrepancies/{cid}", json=body).status_code == 204
    assert client.post(f"/api/discrepancies/{cid}/presentation", json={"presented": True}).status_code == 204
    row = next(r for r in client.get("/api/discrepancies").json() if r["caseId"] == cid)
    assert row["classification"] == "ai_correct"
    assert row["presentation"] == "presented"


def test_pending_features_answer_501(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["supervisor"])
    assert client.get("/api/agents/stats").status_code == 501
    assert client.post("/api/export").status_code == 501
