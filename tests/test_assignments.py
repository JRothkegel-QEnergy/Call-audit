"""Rol verificador y asignación de llamadas (docs/ux/admin-prompt-metrics/13). Sintético."""

from collections import Counter

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import assignments, prompt_evaluation
from call_audit.persistence.models import DisagreementVerification, PromptEvaluation, User, VerificationAssignment
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
    assert card == {"assigned": 2, "pending": 1, "reviewed": 1, "reviewedToday": 1, "nextCaseId": ids[2]}

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


def test_verifier_trays_pending_and_reviewed_with_discrepancy_filter(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """18 (W1-W6): Por revisar y Revisadas del verificador, el filtro por discrepancia y la fecha de revisión."""
    ids = seed_full(imported, admin)
    ana, beto = two
    with imported() as session, session.begin():
        session.add(VerificationAssignment(case_id=ids[0], user_id=ana.id, assigned_by_id=admin.id))
        session.add(VerificationAssignment(case_id=ids[1], user_id=beto.id, assigned_by_id=admin.id))
        session.add(VerificationAssignment(case_id=ids[2], user_id=ana.id, assigned_by_id=admin.id))
    url = "/api/admin/prompts/9.8/agreement/calls"

    def listed(**params: str) -> dict:
        return client.get(url, params={"segment": "all", "source": "full", "assignee": "me", **params}).json()

    login(client, ana)
    home = client.get("/api/verification").json()
    assert home["me"]["pending"] == 2 and home["me"]["reviewed"] == 0
    pending = listed(tray="pending")
    assert {i["caseId"] for i in pending["items"]} == {ids[0], ids[2]}  # nunca la de Beto
    assert pending["discrepancyCounts"] == {"fn": 1, "fp": 0, "undecided": 0, "criteria": 0, "none": 1}
    assert [i["caseId"] for i in listed(tray="pending", discrepancy="fn")["items"]] == [ids[0]]
    assert listed(tray="reviewed")["items"] == []

    # Al registrar el último criterio pasa a Revisadas con su fecha; la llamada abierta conserva su lista.
    put = {"outcome": "reviewer_error", "version": "9.8", "source": "full"}
    assert client.put(f"/api/admin/verifications/{ids[0]}/14", json=put).status_code == 200
    case = client.get(f"{url}/{ids[0]}", params={"segment": "all", "tray": "pending"}).json()
    assert case["position"]["index"] is not None and case["position"]["nextPendingCaseId"] == ids[2]
    reviewed = listed(tray="reviewed")
    assert [i["caseId"] for i in reviewed["items"]] == [ids[0]] and reviewed["items"][0]["lastReviewedAt"]
    assert [i["caseId"] for i in listed(tray="pending")["items"]] == [ids[2]]

    # «Sin observaciones» la manda a Revisadas (la más reciente primero) y «Deshacer» la devuelve.
    client.put(f"/api/admin/assignments/{ids[2]}/reviewed", json={"reviewed": True})
    assert [i["caseId"] for i in listed(tray="reviewed")["items"]] == [ids[2], ids[0]]
    assert client.get("/api/verification").json()["me"]["reviewedToday"] == 2
    client.put(f"/api/admin/assignments/{ids[2]}/reviewed", json={"reviewed": False})
    assert [i["caseId"] for i in listed(tray="pending")["items"]] == [ids[2]]


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


def test_distribute_only_the_given_calls(
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """El reparto desde una planilla (admin distribute) toca solo esas llamadas y deja el resto sin asignar."""
    from call_audit import assignments

    seed_full(imported, admin)
    ana, beto = two
    with imported() as session, session.begin():
        evaluation = session.scalar(select(PromptEvaluation).where(PromptEvaluation.purpose == "full"))
        all_ids = assignments.plan(session, evaluation, [ana.id, beto.id])["_picks"]
        only = set(list(all_ids)[:2])
        done = assignments.distribute(session, evaluation, [ana.id, beto.id], admin, only=only)
        assert set(done["_picks"]) == only
        assert sorted(p["calls"] for p in done["people"]) == [1, 1]
    with imported() as session:
        assert {a.case_id for a in session.scalars(select(VerificationAssignment))} == only


def test_read_call_ids_from_xlsx_and_txt(tmp_path) -> None:
    import openpyxl

    from call_audit.admin import read_call_ids

    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["Llamada", "Motivo"])
    for row in (["187939", 1], [191242, 3], ["187939", 5]):
        sheet.append(row)
    xlsx = tmp_path / "divergencias.xlsx"
    workbook.save(xlsx)
    assert read_call_ids(xlsx) == ["187939", "191242"]
    txt = tmp_path / "llamadas.txt"
    txt.write_text("187939\n\n191242\n187939\n", encoding="utf-8")
    assert read_call_ids(txt) == ["187939", "191242"]


def test_tray_sort_and_summary_progress(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """19 (X1-X5): orden por columna en la lista y en Anterior/Siguiente, y avance del Resumen."""
    ids = seed_full(imported, admin)
    ana, _ = two
    with imported() as session, session.begin():
        for cid in ids[:2]:
            session.add(VerificationAssignment(case_id=cid, user_id=ana.id, assigned_by_id=admin.id))
    login(client, ana)
    url = "/api/admin/prompts/9.8/agreement/calls"
    base = {"segment": "all", "source": "full", "assignee": "me", "tray": "pending"}

    asc = client.get(url, params={**base, "sort": "ai", "dir": "asc"}).json()["items"]
    assert [i["aiVerdict"] for i in asc] == ["compliant", "non_compliant"]
    desc = client.get(url, params={**base, "sort": "ai", "dir": "desc"}).json()["items"]
    assert [i["caseId"] for i in desc] == [ids[1], ids[0]]
    # Anterior/Siguiente siguen el mismo orden que la lista.
    case = client.get(
        f"{url}/{ids[1]}", params={"segment": "all", "tray": "pending", "sort": "ai", "dir": "desc"}
    ).json()
    assert case["position"]["index"] == 1 and case["position"]["nextCaseId"] == ids[0]
    assert client.get(url, params={**base, "sort": "bogus"}).status_code == 422

    mine = client.get("/api/admin/prompts/9.8/verification", params={"assignee": "me"}).json()["progress"]
    assert mine == {"total": 2, "reviewed": 0, "pending": 2}
    team = client.get("/api/admin/prompts/9.8/verification", params={"assignee": "all"}).json()["progress"]
    assert team["total"] == 3 and team["total"] == team["reviewed"] + team["pending"]


def test_summary_counts_qubyt_verdicts_by_criterion(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """22 (AA1-AA4): Cumple / No cumple de Qubyt por criterio, siguiendo «Asignadas a»; lo dudoso no cuenta."""
    ids = seed_full(imported, admin)
    ana, _ = two
    with imported() as session, session.begin():
        full = session.scalar(select(PromptEvaluation).where(PromptEvaluation.purpose == "full"))
        results = [dict(r) for r in full.results]
        results[0]["uncertainCriteria"] = [2]
        full.results = results
        for cid in ids[:2]:
            session.add(VerificationAssignment(case_id=cid, user_id=ana.id, assigned_by_id=admin.id))
    login(client, ana)
    url = "/api/admin/prompts/9.8/verification"
    mine = client.get(url, params={"assignee": "me"}).json()["criteria"]
    team = client.get(url, params={"assignee": "all"}).json()["criteria"]
    assert (mine["calls"], team["calls"]) == (2, 3)
    for block in (mine, team):
        assert block["evaluated"] == block["pass"] + block["fail"]
        assert block["evaluated"] == sum(c["evaluated"] for c in block["byCriterion"])
        assert all(c["evaluated"] == c["pass"] + c["fail"] for c in block["byCriterion"])
    two_mine = next(c for c in mine["byCriterion"] if c["criterionId"] == 2)
    # Llamada 0: el 2 dudoso (no cuenta); llamada 1: Qubyt rechaza por el 2.
    assert two_mine == {"criterionId": 2, "evaluated": 1, "pass": 0, "fail": 1}
    two_team = next(c for c in team["byCriterion"] if c["criterionId"] == 2)
    assert two_team == {"criterionId": 2, "evaluated": 2, "pass": 1, "fail": 1}
    other = next(c for c in mine["byCriterion"] if c["criterionId"] != 2)
    assert other["evaluated"] == 2 and other["fail"] == 0


def test_verifier_approves_or_rejects_agreeing_criteria(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """20 (Y1-Y5): aprobar o rechazar un criterio en que Qubyt y la planilla coinciden."""
    ids = seed_full(imported, admin)
    ana, _ = two
    with imported() as session, session.begin():
        for cid in ids:
            session.add(VerificationAssignment(case_id=cid, user_id=ana.id, assigned_by_id=admin.id))
    login(client, ana)
    put = {"version": "9.8", "source": "full"}
    # Las salidas no se cruzan: en un desacuerdo no vale «los dos…», ni en un acuerdo «error de Qubyt».
    assert client.put(f"/api/admin/verifications/{ids[0]}/14", json={**put, "outcome": "both_right"}).status_code == 400
    assert client.put(f"/api/admin/verifications/{ids[2]}/14", json={**put, "outcome": "ai_error"}).status_code == 400

    # Aprobar no cierra la llamada (sigue «Sin observaciones» pendiente).
    ok = client.put(f"/api/admin/verifications/{ids[2]}/14", json={**put, "outcome": "both_right"})
    assert ok.status_code == 200 and ok.json()["correct"] == "compliant"
    pending = {"segment": "all", "source": "full", "assignee": "me", "tray": "pending"}
    url = "/api/admin/prompts/9.8/agreement/calls"
    assert ids[2] in {i["caseId"] for i in client.get(url, params=pending).json()["items"]}

    # Rechazar: la llamada sin desacuerdos queda revisada como «Qubyt se equivocó».
    bad = client.put(f"/api/admin/verifications/{ids[2]}/14", json={**put, "outcome": "both_wrong"})
    assert bad.status_code == 200 and bad.json()["correct"] == "non_compliant"
    reviewed = client.get(url, params={**pending, "tray": "reviewed"}).json()
    row = next(i for i in reviewed["items"] if i["caseId"] == ids[2])
    assert row["verification"] == "ai_wrong" and row["bothWrong"] == 1
    case = client.get(f"{url}/{ids[2]}", params={"segment": "all"}).json()
    crit = next(c for c in case["criteria"] if c["criterionId"] == 14)
    assert crit["kind"] == "agree" and crit["verification"]["outcome"] == "both_wrong"

    # Deshacer la devuelve a Por revisar.
    assert client.delete(f"/api/admin/verifications/{ids[2]}/14").status_code == 204
    assert ids[2] in {i["caseId"] for i in client.get(url, params=pending).json()["items"]}


def test_old_disagreement_record_reads_as_agreement(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """20: un registro hecho como desacuerdo en otra versión se rotula como acuerdo si ahora coinciden (en las pruebas
    del admin). En la calibración de 9.8 no cuenta: es de otra versión (pedido 2026-11-24)."""
    from call_audit.persistence.models import DisagreementVerification

    ids = seed_full(imported, admin)
    ana, _ = two
    with imported() as session, session.begin():
        session.add(VerificationAssignment(case_id=ids[2], user_id=ana.id, assigned_by_id=admin.id))
        session.add(
            DisagreementVerification(
                case_id=ids[2],
                criterion_id=14,
                outcome="ai_error",
                correct="compliant",
                reviewer_fail_at=False,
                ai_verdict_at="non_compliant",
                version_at="9.7",
                decided_by_id=admin.id,
            )
        )
    login(client, admin)
    case = client.get(f"/api/admin/prompts/9.8/agreement/calls/{ids[2]}", params={"segment": "all"}).json()
    crit = next(c for c in case["criteria"] if c["criterionId"] == 14)
    assert crit["verification"]["outcome"] == "both_right"
    assert case["verification"] == "none"
    login(client, ana)
    case = client.get(f"/api/admin/prompts/9.8/agreement/calls/{ids[2]}", params={"segment": "all"}).json()
    assert next(c for c in case["criteria"] if c["criterionId"] == 14)["verification"] is None


def test_tray_filters_by_rejected_criterion_and_verdicts(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """21 (Z1 A) y 23 (AB3): filtro por criterio rechazado (por Qubyt, por el revisor o por los dos), por veredicto de
    Qubyt y del revisor, con conteos, y Anterior/Siguiente con los mismos filtros."""
    ids = seed_full(imported, admin)
    ana, _ = two
    with imported() as session, session.begin():
        for cid in ids:
            session.add(VerificationAssignment(case_id=cid, user_id=ana.id, assigned_by_id=admin.id))
    login(client, ana)
    url = "/api/admin/prompts/9.8/agreement/calls"
    base = {"segment": "all", "source": "full", "assignee": "me", "tray": "pending"}

    data = client.get(url, params=base).json()
    # El 14 lo rechaza solo el revisor (amarillo); el 2 lo rechaza Qubyt y el revisor lo aprueba (azul).
    assert data["rejectedCounts"] == [
        {"criterionId": 2, "calls": 1, "pending": 1},
        {"criterionId": 14, "calls": 1, "pending": 1},
    ]
    assert data["verdictCounts"]["ai"] == {"compliant": 2, "non_compliant": 1, "uncertain": 0}
    assert data["verdictCounts"]["reviewer"] == {"compliant": 2, "non_compliant": 1}
    assert "evaluator" in data["items"][0]

    assert [i["caseId"] for i in client.get(url, params={**base, "rejected": 2}).json()["items"]] == [ids[1]]
    assert [i["caseId"] for i in client.get(url, params={**base, "rejected": 14}).json()["items"]] == [ids[0]]
    chips = {i["caseId"]: i["rejectedCriteria"] for i in data["items"]}
    assert chips[ids[1]] == [{"criterionId": 2, "kind": "qubyt", "calibration": None}]
    assert chips[ids[0]] == [{"criterionId": 14, "kind": "reviewer", "calibration": None}]
    only = client.get(url, params={**base, "ai_verdict": "compliant", "reviewer_verdict": "non_compliant"}).json()
    assert [i["caseId"] for i in only["items"]] == [ids[0]]
    # Cada conteo se calcula sin su propio filtro.
    assert only["verdictCounts"]["ai"]["non_compliant"] == 0 and only["verdictCounts"]["reviewer"]["compliant"] == 1

    case = client.get(f"{url}/{ids[1]}", params={"segment": "all", "tray": "pending", "rejected": 2}).json()
    assert case["position"]["total"] == 1 and case["position"]["index"] == 1


def test_call_stays_to_calibrate_until_every_criterion_is_calibrated() -> None:
    """Pedido 2026-11-24: un «Qubyt se equivocó» ya no cierra la llamada; sigue en Por calibrar hasta calibrar todo."""
    half = {"disagreements": [{"outcome": "ai_error"}, {"outcome": None}], "verification": "ai_wrong"}
    full = {"disagreements": [{"outcome": "ai_error"}, {"outcome": "reviewer_error"}], "verification": "ai_wrong"}
    assert not assignments.is_reviewed(half, None)
    assert assignments.is_reviewed(full, None)
    # Sin criterios por calibrar: «Sin observaciones» o un acuerdo calibrado al revés.
    assert not assignments.is_reviewed({"disagreements": [], "verification": "none"}, None)
    assert assignments.is_reviewed({"disagreements": [], "verification": "ai_wrong", "bothWrong": 1}, None)


def test_assign_counts_reassign_and_release(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """24 (AD1-AD4 A): cantidad por calibrador desde lo sin asignar, tope con aviso, pasar parte de las pendientes de
    uno a otro y devolverlas a «Sin asignar»."""
    seed_full(imported, admin)
    ana, beto = two
    login(client, admin)
    url = "/api/admin/prompts/9.8/verification/assign"

    def run(source: str, to: list[dict], preview: bool = False):
        return client.post(url, json={"source": source, "to": to, "preview": preview})

    too = run("unassigned", [{"userId": ana.id, "count": 4}], preview=True)
    assert too.status_code == 422 and too.json()["detail"]["available"] == 3

    preview = run("unassigned", [{"userId": ana.id, "count": 2}, {"userId": beto.id}], preview=True).json()
    assert preview["available"] == 3 and [p["calls"] for p in preview["people"]] == [2, 1]
    with imported() as session:
        assert session.scalars(select(VerificationAssignment)).all() == []  # la vista previa no guarda

    run("unassigned", [{"userId": ana.id, "count": 2}, {"userId": beto.id}])
    with imported() as session:
        mine = Counter(a.user_id for a in session.scalars(select(VerificationAssignment)))
    assert mine == {ana.id: 2, beto.id: 1}

    # Una de Ana pasa a Beto; la otra vuelve a «Sin asignar».
    assert run(ana.id, [{"userId": beto.id, "count": 1}, {"userId": None}]).json()["calls"] == 2
    with imported() as session:
        mine = Counter(a.user_id for a in session.scalars(select(VerificationAssignment)))
    assert mine == {beto.id: 2}
    assert run("unassigned", [{"userId": None}]).status_code == 422  # lo sin asignar no vuelve a «Sin asignar»


def test_interleaved_keeps_any_prefix_proportional() -> None:
    items = [{"caseId": f"f{i}", "segment": "promptFn", "order": i} for i in range(6)]
    items += [{"caseId": f"a{i}", "segment": "agree", "order": 10 + i} for i in range(3)]
    first = [it["segment"] for it in assignments.interleaved(items)[:3]]
    assert first.count("promptFn") == 2 and first.count("agree") == 1


def test_full_run_counts_only_its_own_version_records(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """Pedido 2026-11-24 («Solo esta versión»): en la calibración de una versión, lo calibrado en otra no cuenta y se
    puede calibrar de nuevo encima, aunque lo haya hecho otra persona."""
    ids = seed_full(imported, admin)
    ana, beto = two
    with imported() as session, session.begin():
        session.add(VerificationAssignment(case_id=ids[1], user_id=ana.id, assigned_by_id=admin.id))
        # Calibrado por Beto en una versión anterior (9.7): Qubyt rechaza el 2 y el revisor lo aprueba.
        session.add(
            DisagreementVerification(
                case_id=ids[1],
                criterion_id=2,
                outcome="reviewer_error",
                correct="non_compliant",
                reviewer_fail_at=False,
                ai_verdict_at="non_compliant",
                version_at="9.7",
                decided_by_id=beto.id,
            )
        )
    login(client, ana)
    tray = client.get(
        "/api/admin/prompts/9.8/agreement/calls",
        params={"segment": "all", "source": "full", "assignee": "me", "tray": "pending"},
    ).json()
    assert [i["caseId"] for i in tray["items"]] == [ids[1]]  # sigue por calibrar en 9.8
    assert tray["items"][0]["rejectedCriteria"][0]["calibration"] is None
    put = client.put(
        f"/api/admin/verifications/{ids[1]}/2", json={"verdict": "compliant", "version": "9.8", "source": "full"}
    )
    assert put.status_code == 200 and put.json()["versionAt"] == "9.8"


def test_shared_calls_are_calibrated_together(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """23 §7 (AE22 A): las mismas llamadas a dos Supervisores 2, que las calibran juntos y ven el avance del otro."""
    ids = seed_full(imported, admin)
    ana, beto = two
    login(client, admin)
    url = "/api/admin/prompts/9.8/verification/assign"
    both = [{"userId": ana.id, "count": 2}, {"userId": beto.id}]
    preview = client.post(url, json={"source": "unassigned", "to": both, "share": True, "preview": True}).json()
    assert [p["calls"] for p in preview["people"]] == [2, 2]
    assert client.post(url, json={"source": "unassigned", "to": both, "share": True}).status_code == 200
    with imported() as session:
        rows = session.scalars(select(VerificationAssignment)).all()
    assert len(rows) == 2 and all(assignments.assignees(r) == [ana.id, beto.id] for r in rows)
    progress = client.get("/api/admin/prompts/9.8/verification/progress").json()
    assert {p["name"]: p["assigned"] for p in progress["people"]} == {"Ana": 2, "Beto": 2}
    assert progress["total"]["assigned"] == len(ids)

    # La llamada con desacuerdo en C14, compartida a mano; Beto corrige lo que calibró Ana y ve su avance.
    shared = ids[0]
    assert client.put(f"/api/admin/assignments/{shared}", json={"userIds": [ana.id, beto.id]}).status_code == 204
    login(client, ana)
    put = {"outcome": "reviewer_error", "version": "9.8", "source": "full"}
    assert client.put(f"/api/admin/verifications/{shared}/14", json=put).status_code == 200
    login(client, beto)
    case = client.get(f"/api/admin/prompts/9.8/agreement/calls/{shared}").json()
    assert case["canRecord"] is True and case["assignment"]["assigneeName"] == "Ana, Beto"
    assert client.get("/api/admin/prompts/9.8/verification", params={"assignee": ana.id}).json()["n"] >= 2
    assert client.delete(f"/api/admin/verifications/{shared}/14").status_code == 204

    # El admin deja una llamada solo con Beto.
    login(client, admin)
    assert client.put(f"/api/admin/assignments/{shared}", json={"userIds": [beto.id]}).status_code == 204
    with imported() as session:
        row = session.scalar(select(VerificationAssignment).where(VerificationAssignment.case_id == shared))
        assert assignments.assignees(row) == [beto.id]


def test_delete_account_frees_email_and_releases_pending(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
    two: tuple[User, User],
) -> None:
    """AE24: baja lógica; el correo queda libre, no entra más y sus pendientes vuelven a «Sin asignar» o quedan con
    quien las comparte."""
    ids = seed_full(imported, admin)
    ana, beto = two
    with imported() as session, session.begin():
        session.add(
            VerificationAssignment(case_id=ids[0], user_id=ana.id, co_user_ids=[beto.id], assigned_by_id=admin.id)
        )
        session.add(VerificationAssignment(case_id=ids[1], user_id=ana.id, assigned_by_id=admin.id))
    login(client, admin)
    assert client.delete(f"/api/admin/accounts/{admin.id}").status_code == 409  # a sí mismo, no
    assert client.delete(f"/api/admin/accounts/{ana.id}").status_code == 204
    assert all(a["id"] != ana.id for a in client.get("/api/admin/accounts").json())
    with imported() as session:
        rows = {a.case_id: assignments.assignees(a) for a in session.scalars(select(VerificationAssignment))}
        gone = session.get(User, ana.id)
        assert gone.status == "deleted" and gone.email != "ana@qubico-ejemplo.cl"
    assert rows == {ids[0]: [beto.id]}
    invite = {"name": "Ana", "email": "ana@qubico-ejemplo.cl", "role": "supervisor"}
    assert client.post("/api/admin/accounts/invite", json=invite).status_code == 204
    assert (
        client.post("/api/auth/login", json={"email": "ana@qubico-ejemplo.cl", "password": PASSWORD}).status_code == 401
    )
