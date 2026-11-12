"""Administrador Qubico (Cambio 12): cuentas e invitaciones, registro de prompts con su prueba, stats y actividad.
Todo sintético: el modelo de la prueba es un doble y los correos quedan en el OUTBOX del backend console."""

import json
import re
from datetime import UTC, date, datetime, timedelta

import pytest
import yaml
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import prompt_evaluation
from call_audit.api.routes_admin import (
    chile_day,
    first_run_days,
    period_bounds,
    processed_series,
    reviewed_per_day,
)
from call_audit.config import ROOT
from call_audit.notify import email as mail
from call_audit.persistence.models import (
    AsrFailure,
    Case,
    ModelRun,
    PipelineRun,
    PromptEvaluation,
    PromptVersion,
    User,
    WorkerHeartbeat,
)
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
    assert "aiQuality" not in stats
    with imported() as session:
        assert session.get(PromptVersion, "9.9").status == "retired"
    assert "auditor" not in json.dumps(stats).lower()


def run_on(case_id: str, day: int, error: str | None = None) -> ModelRun:
    return ModelRun(case_id=case_id, run_at=datetime(2026, 10, day, 12, tzinfo=UTC), error=error)


def test_series_counts_each_call_on_its_first_successful_run() -> None:
    runs = [run_on("a", 3), run_on("a", 5), run_on("b", 1, error="timeout"), run_on("b", 3), run_on("c", 5)]
    daily, bucket = processed_series(list(first_run_days(runs).values()), None)
    assert bucket == "day"
    assert daily == [
        {"date": "2026-10-03", "calls": 2},
        {"date": "2026-10-04", "calls": 0},
        {"date": "2026-10-05", "calls": 1},
    ]


def test_series_covers_the_whole_period_and_handles_no_runs() -> None:
    assert processed_series([], None) == ([], "day")
    today = date(2026, 10, 20)
    daily, bucket = processed_series([date(2026, 10, 15)], period_bounds("7d", today))
    assert (daily[0]["date"], daily[-1]["date"], len(daily), bucket) == ("2026-10-14", "2026-10-20", 7, "day")
    assert sum(d["calls"] for d in daily) == 1


def test_all_history_over_31_days_groups_by_monday() -> None:
    daily, bucket = processed_series([date(2026, 9, 1), date(2026, 9, 2), date(2026, 10, 12)], None)
    assert bucket == "week"
    assert daily[0] == {"date": "2026-08-31", "calls": 2}
    assert daily[-1] == {"date": "2026-10-12", "calls": 1}
    assert sum(d["calls"] for d in daily) == 3


def test_run_before_midnight_in_chile_belongs_to_that_day() -> None:
    # 02:00 UTC del 15 de octubre son las 23:00 del 14 en Chile (UTC-3).
    assert chile_day(datetime(2026, 10, 15, 2, tzinfo=UTC)) == date(2026, 10, 14)
    assert chile_day(datetime(2026, 10, 15, 2)) == date(2026, 10, 14)


def test_reviewed_per_day_uses_the_period_or_the_first_review() -> None:
    today = date(2026, 10, 20)
    days = [date(2026, 10, 11), date(2026, 10, 20), date(2026, 10, 20)]
    assert reviewed_per_day(days, period_bounds("7d", today), today) == round(2 / 7, 1)
    assert reviewed_per_day(days, None, today) == 0.3
    assert reviewed_per_day([], None, today) == 0.0


def add_runs(db: sessionmaker[Session]) -> None:
    with db() as session, session.begin():
        case_ids = list(session.scalars(select(Case.id)))
        for run in session.scalars(select(ModelRun)):
            session.delete(run)
        session.flush()
        common = {"rubric_version": "1", "verdict": "compliant"}
        at = datetime.now(UTC) - timedelta(days=60)
        for label, model, version, day in [("v1", "m-a", "2.8", 0), ("v2", "m-b", "2.10", 50)]:
            for case_id in case_ids[:2]:
                session.add(
                    ModelRun(
                        case_id=case_id,
                        model=model,
                        run_label=label,
                        prompt_version=version,
                        run_at=at + timedelta(days=day),
                        cost_usd=0.01,
                        **common,
                    )
                )


def test_stats_filters_apply_to_processed_and_cost(
    client: TestClient, admin: User, imported: sessionmaker[Session]
) -> None:
    add_runs(imported)
    login(client, admin)
    everything = client.get("/api/admin/stats").json()
    assert everything["operation"]["callsProcessed"] == 2
    assert len(everything["cost"]) == 2
    assert everything["filters"]["promptVersions"][:2] == ["2.10", "2.8"]
    assert "m-a" in {m["id"] for m in everything["filters"]["models"]}

    # La re-corrida de hace 10 días no cuenta como llamada nueva, pero sí aparece en Costo.
    recent = client.get("/api/admin/stats", params={"period": "30d"}).json()
    assert recent["operation"]["callsProcessed"] == 0
    assert recent["operation"]["daily"] == []
    assert [c["promptVersion"] for c in recent["cost"]] == ["2.10"]

    # Dentro del prompt elegido, esa misma corrida sí es la primera.
    by_prompt = client.get("/api/admin/stats", params={"period": "30d", "prompt": "2.10"}).json()
    assert by_prompt["operation"]["callsProcessed"] == 2
    assert len(by_prompt["operation"]["daily"]) == 30

    none = client.get("/api/admin/stats", params={"model": "m-a", "prompt": "2.10"}).json()
    assert none["cost"] == [] and none["filters"]["lastRunAt"] is None and none["filters"]["range"] is None
    assert client.get("/api/admin/stats", params={"period": "90d"}).status_code == 422


# --- Procesamiento (Cambio 14) -----------------------------------------------------------------------------------


def beat(db: sessionmaker[Session], ago: timedelta) -> None:
    with db() as session, session.begin():
        row = session.get(WorkerHeartbeat, 1) or WorkerHeartbeat(id=1)
        row.last_seen_at = datetime.now(UTC) - ago
        row.next_run_at = datetime.now(UTC) + timedelta(minutes=10)
        row.loop_seconds = 900
        session.add(row)


def test_processing_is_admin_only(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["supervisor"])
    assert client.get("/api/admin/processing").status_code == 403
    assert client.get("/api/admin/processing/runs").status_code == 403
    assert client.get("/api/admin/processing/asr-failures").status_code == 403


def test_processing_states(client: TestClient, admin: User, imported: sessionmaker[Session]) -> None:
    login(client, admin)
    assert client.get("/api/admin/processing").json()["state"] == "no_data"

    beat(imported, timedelta(seconds=10))
    assert client.get("/api/admin/processing").json()["state"] == "idle"

    with imported() as session, session.begin():
        session.add(PipelineRun(status="running", stage="transcribing", transcribe_total=100, transcribed=68))
    body = client.get("/api/admin/processing").json()
    assert body["state"] == "running" and body["stage"] == "transcribing"
    assert body["currentRun"]["transcribed"] == 68 and body["currentRun"]["transcribeTotal"] == 100

    # Sin latido reciente, "no responde" le gana a la pasada abierta.
    beat(imported, timedelta(minutes=4))
    body = client.get("/api/admin/processing").json()
    assert body["state"] == "stale" and body["currentRun"] is None

    with imported() as session, session.begin():
        run = session.scalar(select(PipelineRun))
        run.status, run.error, run.finished_at = "failed", "ConnectionError: sftp", datetime.now(UTC)
    beat(imported, timedelta(seconds=5))
    body = client.get("/api/admin/processing").json()
    assert body["state"] == "last_failed" and body["lastRun"]["error"] == "ConnectionError: sftp"


def test_processing_runs_and_failures(client: TestClient, admin: User, imported: sessionmaker[Session]) -> None:
    with imported() as session, session.begin():
        session.add_all(PipelineRun(status="done", audios=i) for i in range(25))
        session.add(AsrFailure(stem="grabacion_1", error="RuntimeError: x", attempts=2))
    login(client, admin)

    runs = client.get("/api/admin/processing/runs").json()
    assert len(runs) == 20 and runs[0]["audios"] == 24
    [failure] = client.get("/api/admin/processing/asr-failures").json()
    assert failure["stem"] == "grabacion_1" and failure["attempts"] == 2


# --- Calidad de la IA por corrida (Cambio 15) --------------------------------------------------------------------


def test_quality_is_admin_only(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["supervisor"])
    assert client.get("/api/admin/quality").status_code == 403


def test_quality_series_and_calls(client: TestClient, admin: User, imported: sessionmaker[Session]) -> None:
    with imported() as session, session.begin():
        cases = list(session.scalars(select(Case).order_by(Case.call_id)))
        cases[0].external_item_fails = [14]
        # La vigente repartida en dos corridas, como en producción (la manual y la automática del worker).
        cases[1].runs[0].run_label = "v9.9 automático"
        session.add(
            PromptEvaluation(
                version="9.9",
                model=MODEL,
                status="done",
                requested_by_id=admin.id,
                case_ids=[c.id for c in cases],
                done=1,
                results=[{"caseId": cases[0].id, "verdict": "non_compliant", "failCriteria": [14, 2]}],
                metrics={"costPerCallUsd": 0.01},
            )
        )
    login(client, admin)
    body = client.get("/api/admin/quality").json()
    run = next(s for s in body["series"] if s["source"] == "run" and s["isCurrent"])
    test = next(s for s in body["series"] if s["source"] == "prompt_test")
    assert run["id"] == "current" and run["runLabel"] == "Vigente" and run["calls"] == 3
    by_label = {s["id"]: s for s in body["series"] if s["source"] == "run" and not s["isCurrent"]}
    assert {k: s["calls"] for k, s in by_label.items()} == {"run:modelo-a:v9.9": 2, "run:modelo-a:v9.9 automático": 1}
    assert test["runLabel"] == "Prueba v9.9" and test["calls"] == 1 and test["costPerCallUsd"] == 0.01
    first = next(c for c in body["calls"] if c["caseId"] == cases[0].id)
    assert first["clientFails"] == [14]
    assert first["results"][test["id"]] == {"verdict": "non_compliant", "failCriteria": [2, 14]}
    assert run["id"] in first["results"]
    assert len(body["criteria"]) == 33 and body["criteria"][0]["byCode"] and body["criteria"][18]["partial"]
    assert body["goals"] == {"falsePositivePct": 5, "falseNegativePct": 20}
    assert "Ejecutivo" not in json.dumps(body)
