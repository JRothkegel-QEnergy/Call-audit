"""Rol verificador y asignación de llamadas (docs/ux/admin-prompt-metrics/13). Sintético."""

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import prompt_evaluation
from call_audit.persistence.models import PromptEvaluation, User, VerificationAssignment
from tests.conftest import PASSWORD, login
from tests.test_admin import admin  # noqa: F401
from tests.test_verification import seed_tested_version


def make_verifier(imported: sessionmaker[Session], name: str) -> User:
    user = User(
        email=f"{name.lower()}@qubico-ejemplo.cl",
        name=name,
        role="qubico_verifier",
        permissions=[],
        password_hash=PasswordHasher().hash(PASSWORD),
    )
    with imported() as session, session.begin():
        session.add(user)
    return user


def seed_full(imported: sessionmaker[Session], admin: User, version: str = "9.8") -> list[str]:  # noqa: F811
    """La prueba de `version` y una corrida completa terminada con los mismos resultados."""
    ids = seed_tested_version(imported, admin, version)
    with imported() as session, session.begin():
        test = session.scalar(select(PromptEvaluation).where(PromptEvaluation.version == version))
        session.add(
            PromptEvaluation(
                version=version,
                model=test.model,
                status="done",
                requested_by_id=admin.id,
                case_ids=list(test.case_ids),
                done=test.done,
                results=list(test.results),
                purpose="full",
                finished_at=prompt_evaluation.now(),
            )
        )
    return ids


@pytest.fixture
def two(imported: sessionmaker[Session]) -> tuple[User, User]:
    return make_verifier(imported, "Ana"), make_verifier(imported, "Beto")


def test_verifier_only_sees_the_verification(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    seed_full(imported, admin)
    login(client, two[0])
    assert client.get("/api/verification").json()["version"] == "9.8"
    assert client.get("/api/admin/prompts").status_code == 403
    assert client.get("/api/admin/accounts").status_code == 403
    assert client.get("/api/admin/prompts/9.8/verification/progress").status_code == 403
    overview = client.get("/api/admin/prompts/9.8/verification").json()
    # Sin asignación, «Mí» parte vacío.
    assert overview["assignee"] == "me" and overview["n"] == 0 and overview["me"]["assigned"] == 0
    assert overview["verifiers"] == []


def test_distribute_is_stratified_stable_and_does_not_move_assigned(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    seed_full(imported, admin)
    ana, beto = two
    login(client, admin)
    body = {"userIds": [ana.id, beto.id]}
    preview = client.post("/api/admin/prompts/9.8/verification/distribute/preview", json=body).json()
    assert preview["calls"] == 3 and sorted(p["calls"] for p in preview["people"]) == [1, 2]
    done = client.post("/api/admin/prompts/9.8/verification/distribute", json=body).json()
    assert done["people"] == preview["people"]
    # Repartir de nuevo no mueve nada: ya no queda nada sin asignar.
    again = client.post("/api/admin/prompts/9.8/verification/distribute/preview", json=body).json()
    assert again["calls"] == 0

    progress = client.get("/api/admin/prompts/9.8/verification/progress").json()
    assert progress["total"]["assigned"] == 3 and progress["unassigned"]["assigned"] == 0
    assert sorted(p["assigned"] for p in progress["people"]) == [1, 2]

    mine = client.get("/api/admin/prompts/9.8/verification", params={"assignee": ana.id}).json()
    assert mine["n"] == next(p["calls"] for p in done["people"] if p["id"] == ana.id)


def test_verifier_records_only_on_own_calls_and_own_records(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    ids = seed_full(imported, admin)
    ana, beto = two
    with imported() as session, session.begin():
        session.add(VerificationAssignment(case_id=ids[0], user_id=ana.id, assigned_by_id=admin.id))
        session.add(VerificationAssignment(case_id=ids[1], user_id=beto.id, assigned_by_id=admin.id))
        session.add(VerificationAssignment(case_id=ids[2], user_id=ana.id, assigned_by_id=admin.id))

    login(client, beto)
    other = client.get(f"/api/admin/prompts/9.8/agreement/calls/{ids[0]}").json()
    assert other["canRecord"] is False and other["assignment"]["assigneeName"] == "Ana"
    put = {"outcome": "reviewer_error", "version": "9.8", "source": "full"}
    assert client.put(f"/api/admin/verifications/{ids[0]}/14", json=put).status_code == 403

    login(client, ana)
    case = client.get(f"/api/admin/prompts/9.8/agreement/calls/{ids[0]}", params={"segment": "promptFn"}).json()
    assert case["canRecord"] is True and case["assignment"]["mine"] is True
    assert client.put(f"/api/admin/verifications/{ids[0]}/14", json=put).status_code == 200
    card = client.get("/api/admin/prompts/9.8/verification").json()["me"]
    assert card == {"assigned": 2, "pending": 1, "nextCaseId": ids[2]}

    # La llamada sin desacuerdos se cierra con «Sin observaciones» y se puede deshacer.
    ok = client.put(f"/api/admin/assignments/{ids[2]}/reviewed", json={"reviewed": True})
    assert ok.status_code == 200 and ok.json()["reviewedBy"] == "Ana"
    assert client.get("/api/admin/prompts/9.8/verification").json()["me"]["pending"] == 0
    assert client.put(f"/api/admin/assignments/{ids[2]}/reviewed", json={"reviewed": False}).status_code == 200

    # Beto no puede cambiar ni borrar el registro de Ana, aunque le pasen la llamada después.
    with imported() as session, session.begin():
        row = session.scalar(select(VerificationAssignment).where(VerificationAssignment.case_id == ids[0]))
        row.user_id = beto.id
    login(client, beto)
    assert client.put(f"/api/admin/verifications/{ids[0]}/14", json=put).status_code == 403
    assert client.delete(f"/api/admin/verifications/{ids[0]}/14").status_code == 403

    # El admin corrige cualquiera.
    login(client, admin)
    assert client.delete(f"/api/admin/verifications/{ids[0]}/14").status_code == 204


def test_move_pending_keeps_reviewed_calls(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    ids = seed_full(imported, admin)
    ana, beto = two
    with imported() as session, session.begin():
        for cid in ids:
            session.add(VerificationAssignment(case_id=cid, user_id=ana.id, assigned_by_id=admin.id))
    login(client, ana)
    client.put(f"/api/admin/assignments/{ids[2]}/reviewed", json={"reviewed": True})
    login(client, admin)
    moved = client.post(
        "/api/admin/prompts/9.8/verification/move", json={"fromUserId": ana.id, "toUserIds": [beto.id]}
    ).json()
    assert moved == {"moved": 2}
    with imported() as session:
        owners = {a.case_id: a.user_id for a in session.scalars(select(VerificationAssignment))}
    assert owners == {ids[0]: beto.id, ids[1]: beto.id, ids[2]: ana.id}


def test_full_run_reuses_results_and_does_not_replace_the_test(
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
) -> None:
    ids = seed_tested_version(imported, admin)
    with imported() as session, session.begin():
        plan = prompt_evaluation.full_plan(session, "9.8")
        # Solo la llamada 1 trae «findings» (resultado completo); las otras se vuelven a correr.
        assert plan["calls"] == 3 and plan["reused"] == 1 and plan["missing"] == 2
        ev = prompt_evaluation.start_full(session, "9.8", session.get(User, admin.id))
        assert ev.purpose == "full" and ev.done == 1 and ev.results[0]["caseId"] == ids[1]
        assert ev.results[0]["cost"] == 0.0
        with pytest.raises(ValueError, match="already_running"):
            prompt_evaluation.start_full(session, "9.8", session.get(User, admin.id))
        # La prueba de la versión sigue siendo la prueba, no la corrida completa.
        assert prompt_evaluation.latest(session, "9.8").purpose is None
