"""Administrador Qubico (Cambio 12): cuentas e invitaciones, registro de prompts con su prueba, stats y actividad.
Todo sintético: el modelo de la prueba es un doble y los correos quedan en el OUTBOX del backend console."""

import json
import re

import pytest
import yaml
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from call_audit import prompt_evaluation
from call_audit.config import ROOT
from call_audit.notify import email as mail
from call_audit.persistence.models import PromptVersion, User
from tests.conftest import PASSWORD, login

MODEL = prompt_evaluation.models()[0]["name"]


@pytest.fixture
def admin(imported: sessionmaker[Session]) -> User:
    user = User(
        email="admin@qubico-ejemplo.cl",
        name="Admin",
        role="qubico_admin",
        permissions=[],
        password_hash=PasswordHasher().hash(PASSWORD),
    )
    with imported() as session, session.begin():
        session.add(user)
    return user


@pytest.fixture(autouse=True)
def empty_outbox():
    mail.OUTBOX.clear()


def token_from_last_email() -> str:
    match = re.search(r"/invite/([\w-]+)", mail.OUTBOX[-1].text)
    assert match, mail.OUTBOX[-1].text
    return match.group(1)


def test_only_admin_reaches_admin_routes(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["supervisor"])
    assert client.get("/api/admin/accounts").status_code == 403
    assert client.get("/api/admin/prompts").status_code == 403


def test_admin_does_not_see_supervisor_dashboards(client: TestClient, admin: User) -> None:
    login(client, admin)
    assert client.get("/api/kpis").status_code == 403
    assert client.get("/api/discrepancies").status_code == 200


def test_invitation_by_email_creates_password_once(client: TestClient, admin: User) -> None:
    login(client, admin)
    body = {
        "name": "Persona Nueva",
        "email": "nueva@ejemplo.cl",
        "role": "supervisor",
        "permissions": ["manage_catalog"],
    }
    assert client.post("/api/admin/accounts/invite", json=body).status_code == 204
    assert client.post("/api/admin/accounts/invite", json=body).status_code == 409
    assert mail.OUTBOX[-1].subject == "Te invitaron a Call Audit"
    token = token_from_last_email()

    client.post("/api/auth/logout")
    info = client.get(f"/api/auth/invite/{token}").json()
    assert info["state"] == "valid" and info["role"] == "supervisor" and info["invitedBy"] == "Admin"
    short = client.post(f"/api/auth/invite/{token}", json={"password": "corta", "acceptTerms": True})
    assert short.status_code == 422
    no_terms = client.post(f"/api/auth/invite/{token}", json={"password": "una-clave-larga-123"})
    assert no_terms.status_code == 422
    ok = client.post(f"/api/auth/invite/{token}", json={"password": "una-clave-larga-123", "acceptTerms": True})
    assert ok.status_code == 200 and ok.json()["role"] == "supervisor"
    assert client.get("/api/auth/me").json()["email"] == "nueva@ejemplo.cl"
    assert client.get(f"/api/auth/invite/{token}").json()["state"] == "revoked"


def test_resend_revokes_previous_link(client: TestClient, admin: User) -> None:
    login(client, admin)
    client.post("/api/admin/accounts/invite", json={"name": "A", "email": "a@ejemplo.cl", "role": "auditor"})
    first = token_from_last_email()
    account = next(a for a in client.get("/api/admin/accounts").json() if a["email"] == "a@ejemplo.cl")
    assert client.post(f"/api/admin/accounts/{account['id']}/resend").status_code == 204
    assert client.get(f"/api/auth/invite/{first}").json()["state"] == "revoked"
    assert client.get(f"/api/auth/invite/{token_from_last_email()}").json()["state"] == "valid"


def test_admin_cannot_deactivate_self_or_last_admin(client: TestClient, admin: User) -> None:
    login(client, admin)
    assert (
        client.post(f"/api/admin/accounts/{admin.id}/status", json={"status": "deactivated"}).json()["detail"] == "self"
    )


def test_supervisor_invites_auditors_only(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["supervisor"])
    assert client.post("/api/auditors/invite", json={"name": "B", "email": "b@ejemplo.cl"}).status_code == 204
    assert mail.OUTBOX[-1].to == "b@ejemplo.cl"


def text_draft(client: TestClient, version: str) -> dict:
    return client.post(
        "/api/admin/prompts",
        json={
            "source": "text",
            "content": "Eres un auditor sintético. Evalúa los 33 motivos.",
            "version": version,
            "model": MODEL,
            "changelog": "Prueba sintética",
        },
    ).json()


def fake_model(model: str, system: str, user: str) -> tuple[str, float, int]:
    audit = {"criterios": [{"id": 12, "estado": "incumple", "evidencia": [{"cita": "Quiero renunciar al seguro."}]}]}
    return json.dumps(audit), 0.002, 800


def test_prompt_version_flow_with_evaluation_and_rollback(
    client: TestClient, admin: User, imported: sessionmaker[Session]
) -> None:
    login(client, admin)
    versions = client.get("/api/admin/prompts").json()
    active = next(v for v in versions if v["status"] == "active")
    assert active["source"] == "repo"

    low = client.post(
        "/api/admin/prompts",
        json={"source": "text", "content": "x", "version": "0.1", "model": MODEL, "changelog": "baja"},
    )
    assert low.status_code == 422 and "mayor que la vigente" in low.json()["detail"]["errors"][0]

    major, minor = active["version"].split(".")
    new = f"{major}.{int(minor) + 1}"
    assert text_draft(client, new)["status"] == "draft"
    detail = client.get(f"/api/admin/prompts/{new}").json()
    assert detail["diff"]["kind"] == "text" and detail["activeVersion"] == active["version"]
    assert "Formato de respuesta" in detail["systemText"]

    estimate = client.get(f"/api/admin/prompts/{new}/estimate").json()
    assert estimate["calls"] == 3
    assert client.post(f"/api/admin/prompts/{new}/evaluation", json={}).status_code == 422
    started = client.post(f"/api/admin/prompts/{new}/evaluation", json={"confirm": True})
    assert started.status_code == 200 and started.json()["total"] == 3
    edit = client.put(f"/api/admin/prompts/{new}", json={"content": "y", "model": MODEL, "changelog": "z"})
    assert edit.status_code == 422  # en prueba ya es inmutable

    prompt_evaluation.process_pending(imported, caller=fake_model)
    evaluation = client.get(f"/api/admin/prompts/{new}").json()["evaluation"]
    assert evaluation["status"] == "done" and evaluation["done"] == 3
    client_ref = next(r for r in evaluation["metrics"]["references"] if r["kind"] == "client")
    assert client_ref["n"] == 3 and client_ref["aiOnlyFail"] == 2

    assert client.post(f"/api/admin/prompts/{new}/activate", json={"reason": ""}).status_code == 422
    assert client.post(f"/api/admin/prompts/{new}/activate", json={"reason": "Mejora"}).status_code == 204
    statuses = {v["version"]: v["status"] for v in client.get("/api/admin/prompts").json()}
    assert statuses[new] == "active" and statuses[active["version"]] == "retired"
    assert client.get("/api/prompts/active").json()["changedInApp"] is True

    back = client.post(f"/api/admin/prompts/{active['version']}/activate", json={"reason": "Volver"})
    assert back.status_code == 204
    actions = [a["action"] for a in client.get("/api/admin/activity").json()]
    assert {"prompt_published", "prompt_tested", "prompt_activated", "prompt_rolled_back"} <= set(actions)


def test_evaluation_can_be_stopped(client: TestClient, admin: User, imported: sessionmaker[Session]) -> None:
    login(client, admin)
    active = next(v for v in client.get("/api/admin/prompts").json() if v["status"] == "active")
    major, minor = active["version"].split(".")
    new = f"{major}.{int(minor) + 1}"
    text_draft(client, new)
    client.post(f"/api/admin/prompts/{new}/evaluation", json={"confirm": True})
    assert client.post(f"/api/admin/prompts/{new}/evaluation/stop").status_code == 204
    prompt_evaluation.process_pending(imported, caller=fake_model)
    detail = client.get(f"/api/admin/prompts/{new}").json()
    assert detail["meta"]["status"] == "test_failed" and detail["evaluation"]["status"] == "stopped"


def test_yaml_upload_requires_history_for_changed_rules(client: TestClient, admin: User) -> None:
    login(client, admin)
    spec = yaml.safe_load((ROOT / "prompts" / "layer2" / "prompt.yaml").read_text(encoding="utf-8"))
    major, minor = str(spec["version"]).split(".")
    spec["version"] = f"{major}.{int(minor) + 1}"
    item = spec["sections"][0]["items"][0]
    item["text"] = item.get("text", "") + " (cambio sintético)"
    body = {"source": "yaml", "model": MODEL, "changelog": "Cambio sintético"}
    missing = client.post("/api/admin/prompts", json=body | {"content": yaml.safe_dump(spec, allow_unicode=True)})
    assert missing.status_code == 422
    assert any("agrega en su history" in e for e in missing.json()["detail"]["errors"])

    item["history"].append({"version": spec["version"], "origin": "design", "note": "Prueba"})
    ok = client.post("/api/admin/prompts", json=body | {"content": yaml.safe_dump(spec, allow_unicode=True)})
    assert ok.status_code == 200, ok.text
    diff = client.get(f"/api/admin/prompts/{spec['version']}").json()["diff"]
    assert diff["kind"] == "rules" and diff["rules"][0]["id"] == item["id"]
    assert diff["rules"][0]["origin"] == "Diseño Qubico"
    exported = client.get(f"/api/admin/prompts/{spec['version']}/export")
    assert exported.headers["content-type"] == "application/zip"


def test_stats_have_no_people(client: TestClient, admin: User, imported: sessionmaker[Session]) -> None:
    login(client, admin)
    stats = client.get("/api/admin/stats").json()
    assert stats["operation"]["callsProcessed"] == 3
    assert stats["aiQuality"][0]["n"] == 3
    with imported() as session:
        assert session.get(PromptVersion, "9.9").status == "retired"
    assert "auditor" not in json.dumps(stats).lower()
