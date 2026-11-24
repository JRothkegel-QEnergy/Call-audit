"""Verificación caso a caso del mosaico (docs/ux/admin-prompt-metrics/04-verificacion-propuesta.md). Sintético."""

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit import verification
from call_audit.persistence.models import AccessLog, Case, PromptEvaluation, PromptVersion, User
from tests.conftest import PASSWORD, login
from tests.test_admin import MODEL, admin  # noqa: F401


@pytest.fixture
def viewer(imported: sessionmaker[Session]) -> User:
    user = User(
        email="jefe@qubico-ejemplo.cl",
        name="Jefe",
        role="qubico_viewer",
        permissions=[],
        password_hash=PasswordHasher().hash(PASSWORD),
    )
    with imported() as session, session.begin():
        session.add(user)
    return user


def seed_tested_version(imported: sessionmaker[Session], admin: User, version: str = "9.8") -> list[str]:  # noqa: F811
    """Una prueba terminada de `version`: la llamada 0 en rojo (IA cumple, planilla rechaza por el 14), la 1 en
    amarillo (IA rechaza por el 2) y la 2 de acuerdo."""
    with imported() as session, session.begin():
        cases = list(session.scalars(select(Case).order_by(Case.call_id)))
        cases[0].external_verdict, cases[0].external_item_fails = "non_compliant", [14]
        cases[1].external_verdict, cases[1].external_item_fails = "compliant", []
        cases[2].external_verdict, cases[2].external_item_fails = "compliant", []
        if session.get(PromptVersion, version) is None:
            session.add(PromptVersion(version=version, system_text="x", status="tested"))
        session.add(
            PromptEvaluation(
                version=version,
                model=MODEL,
                status="done",
                requested_by_id=admin.id,
                case_ids=[c.id for c in cases],
                done=3,
                results=[
                    {"caseId": cases[0].id, "verdict": "compliant", "external": "non_compliant", "externalFails": [14]},
                    {
                        "caseId": cases[1].id,
                        "verdict": "non_compliant",
                        "external": "compliant",
                        "externalFails": [],
                        "failCriteria": [2],
                        "findings": [
                            {
                                "criterionId": 2,
                                "verdict": "non_compliant",
                                "comment": "No explica la cobertura.",
                                "evidence": {"quote": "eso no lo sé", "startMs": 1000, "quoteValidated": True},
                                "suggestedReasons": [
                                    {"reason": "Problemas Económicos", "quote": "no me alcanza", "quoteValidated": True}
                                ],
                            }
                        ],
                    },
                    {"caseId": cases[2].id, "verdict": "compliant", "external": "compliant", "externalFails": []},
                ],
                metrics={"costPerCallUsd": 0.01},
            )
        )
        return [c.id for c in cases]


def test_wilson_and_call_status() -> None:
    assert verification.wilson(0, 0) is None
    lo, hi = verification.wilson(7, 10)
    assert 0.39 < lo < 0.40 and 0.89 < hi < 0.90
    assert verification.call_status([]) == "none"
    assert verification.call_status(["reviewer_error", None]) == "pending"
    assert verification.call_status(["reviewer_error", "ai_error", None]) == "ai_wrong"
    assert verification.call_status(["reviewer_error", "reviewer_error"]) == "confirmed"
    assert verification.call_status(["reviewer_error", "missing_info"]) == "inconclusive"


def test_segment_lists_calls_and_verification_sums(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
) -> None:
    ids = seed_tested_version(imported, admin)
    login(client, admin)
    red = client.get("/api/admin/prompts/9.8/agreement/calls", params={"segment": "promptFn"}).json()
    assert red["n"] == 3 and [i["caseId"] for i in red["items"]] == [ids[0]]
    assert red["items"][0]["disagreements"] == [{"criterionId": 14, "kind": "fn", "blue": False, "outcome": None}]
    assert red["summary"] == {
        "calls": 1,
        "reviewed": 0,
        "confirmed": 0,
        "aiWrong": 0,
        "inconclusive": 0,
        "pending": 1,
        "ci95": None,
        "seenFirst": 0,
        "bothWrong": 0,
    }

    put = client.put(
        f"/api/admin/verifications/{ids[0]}/14", json={"outcome": "reviewer_error", "version": "9.8", "seenFirst": True}
    )
    assert put.status_code == 200 and put.json()["correct"] == "compliant"
    red = client.get("/api/admin/prompts/9.8/agreement/calls", params={"segment": "promptFn"}).json()
    assert red["items"][0]["verification"] == "confirmed"
    assert red["summary"]["reviewed"] == 1 and red["summary"]["seenFirst"] == 1

    # La suma también llega al mosaico de la prueba.
    detail = client.get("/api/admin/prompts/9.8").json()
    assert detail["evaluation"]["metrics"]["agreement"]["verification"]["promptFn"]["confirmed"] == 1

    with imported() as session:
        assert session.scalar(select(AccessLog).where(AccessLog.action == "disagreement_verified")) is not None

    assert client.delete(f"/api/admin/verifications/{ids[0]}/14").status_code == 204
    red = client.get("/api/admin/prompts/9.8/agreement/calls", params={"segment": "promptFn"}).json()
    assert red["items"][0]["verification"] == "pending"


def test_case_shows_the_tested_version_and_hides_nothing(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
) -> None:
    ids = seed_tested_version(imported, admin)
    login(client, admin)
    case = client.get(f"/api/admin/prompts/9.8/agreement/calls/{ids[1]}", params={"segment": "promptFp"}).json()
    assert case["version"] == "9.8" and case["segment"] == "promptFp" and case["aiVerdict"] == "non_compliant"
    two = next(c for c in case["criteria"] if c["criterionId"] == 2)
    assert two["kind"] == "fp" and two["ai"]["verdict"] == "non_compliant" and two["reviewerFail"] is False
    assert two["ai"]["comment"] == "No explica la cobertura." and two["ai"]["evidence"][0]["startMs"] == 1000
    # Los motivos sugeridos (motivo 18) pasan tal cual; los demás motivos los traen vacíos.
    assert two["ai"]["suggestedReasons"] == [
        {"reason": "Problemas Económicos", "quote": "no me alcanza", "quoteValidated": True}
    ]
    assert all(c["ai"]["suggestedReasons"] == [] for c in case["criteria"] if c["criterionId"] != 2)
    assert case["position"] == {
        "index": 1,
        "total": 1,
        "pending": 1,
        "prevCaseId": None,
        "nextCaseId": None,
        "nextPendingCaseId": None,
    }
    assert client.get("/api/admin/prompts/9.8/agreement/calls/nope").status_code == 404


def test_a_verification_counts_for_every_version(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
) -> None:
    ids = seed_tested_version(imported, admin, "9.8")
    login(client, admin)
    # En 9.8 la IA dijo cumple en el 14 y la planilla no cumple: se registra que la IA se equivocó.
    client.put(f"/api/admin/verifications/{ids[0]}/14", json={"outcome": "ai_error", "version": "9.8"})
    with imported() as session, session.begin():
        session.add(PromptVersion(version="9.7", system_text="x", status="tested"))
        session.add(
            PromptEvaluation(
                version="9.7",
                model=MODEL,
                status="done",
                requested_by_id=admin.id,
                case_ids=[ids[0]],
                done=1,
                # 9.7 rechaza por el 14 y por el 3: coincide en el 14 y desacuerda en el 3.
                results=[
                    {
                        "caseId": ids[0],
                        "verdict": "non_compliant",
                        "external": "non_compliant",
                        "externalFails": [14],
                        "failCriteria": [3, 14],
                    }
                ],
                metrics={"costPerCallUsd": 0.01},
            )
        )
    case = client.get(f"/api/admin/prompts/9.7/agreement/calls/{ids[0]}", params={"segment": "agree"}).json()
    fourteen = next(c for c in case["criteria"] if c["criterionId"] == 14)
    assert fourteen["kind"] == "agree" and fourteen["verification"]["correct"] == "non_compliant"
    agree = client.get("/api/admin/prompts/9.7/agreement/calls", params={"segment": "agree"}).json()
    assert agree["items"][0]["disagreements"] == [{"criterionId": 3, "kind": "fp", "blue": False, "outcome": None}]


def test_reimported_sheet_makes_the_verification_stale(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
) -> None:
    ids = seed_tested_version(imported, admin)
    login(client, admin)
    client.put(f"/api/admin/verifications/{ids[1]}/2", json={"outcome": "ai_error", "version": "9.8"})
    with imported() as session, session.begin():
        evaluation = session.scalar(select(PromptEvaluation).where(PromptEvaluation.version == "9.8"))
        results = [dict(r) for r in evaluation.results]
        results[1]["externalFails"] = [2]
        evaluation.results = results
    case = client.get(f"/api/admin/prompts/9.8/agreement/calls/{ids[1]}").json()
    two = next(c for c in case["criteria"] if c["criterionId"] == 2)
    assert two["kind"] == "agree" and two["verification"]["stale"] is True


def test_viewer_reads_but_does_not_write(
    client: TestClient,
    admin: User,  # noqa: F811
    viewer: User,
    imported: sessionmaker[Session],
) -> None:
    ids = seed_tested_version(imported, admin)
    login(client, viewer)
    assert client.get("/api/admin/prompts/9.8/agreement/calls", params={"segment": "promptFn"}).status_code == 200
    assert client.get("/api/admin/prompts").status_code == 200
    assert client.get("/api/admin/quality").status_code == 200
    assert client.get("/api/admin/accounts").status_code == 403
    put = client.put(f"/api/admin/verifications/{ids[0]}/14", json={"outcome": "ai_error", "version": "9.8"})
    assert put.status_code == 403
    assert client.post("/api/admin/prompts/9.8/activate", json={"reason": "x"}).status_code == 403


def test_list_sides_and_criterion() -> None:
    """Listas de la cabecera común (05-numeros-propuesta.md §3, §7): el lado fp/fn incluye el azul de ese lado, y con
    un motivo entran solo las llamadas con desacuerdo en él."""
    from call_audit.verification import matches

    def row(segment: str, external: str, items: list[tuple[int, str]]) -> dict:
        return {
            "segment": segment,
            "result": {"external": external},
            "items": [{"criterionId": c, "kind": k, "blue": False} for c, k in items],
        }

    fp_yellow = row("promptFp", "compliant", [(2, "fp")])
    fp_blue = row("reviewer", "compliant", [(2, "fp")])
    fn_blue = row("reviewer", "non_compliant", [(14, "fn")])
    agree_item = row("agree", "non_compliant", [(14, "fp"), (5, "undecided")])
    rows = [fp_yellow, fp_blue, fn_blue, agree_item]
    assert [r for r in rows if matches(r, "fp")] == [fp_yellow, fp_blue]
    assert [r for r in rows if matches(r, "fn")] == [fn_blue]
    assert [r for r in rows if matches(r, "disagree")] == rows
    assert [r for r in rows if matches(r, "disagree", 14)] == [fn_blue, agree_item]
    assert [r for r in rows if matches(r, "fp", 14)] == [agree_item]
    assert not any(matches(r, "disagree", 5) for r in rows)
    # La lista «all» por motivo también trae las dudosas (16-lista-verificador-por-motivo, L2 A); los lados no.
    assert [r for r in rows if matches(r, "all", 5)] == [agree_item]
    assert not any(matches(r, "fp", 5) or matches(r, "fn", 5) for r in rows)


def test_criterion_counts_include_undecided_and_sort_by_calls() -> None:
    from call_audit.verification import criterion_counts

    def item(verification: str, kinds: list[tuple[int, str]]) -> dict:
        return {"verification": verification, "disagreements": [{"criterionId": c, "kind": k} for c, k in kinds]}

    items = [
        item("pending", [(25, "fn"), (18, "undecided")]),
        item("done", [(25, "fp"), (25, "undecided")]),
        item("pending", [(18, "fp"), (3, "fn")]),
        item("none", []),
    ]
    assert criterion_counts(items) == [
        {"criterionId": 18, "calls": 2, "pending": 2},
        {"criterionId": 25, "calls": 2, "pending": 1},
        {"criterionId": 3, "calls": 1, "pending": 1},
    ]


def test_reason_match_splits_agree_and_its_lists() -> None:
    """Acuerdo en motivos (15-acuerdo-en-motivos-brief.md §8): solo dentro de "agree"; un motivo dudoso de la IA no
    cuenta como rechazo suyo (H-M1); los cuatro tramos suman byCall.agree."""
    from call_audit import agreement
    from call_audit.verification import matches

    fail, ok = "non_compliant", "compliant"
    results = [
        {"caseId": "p", "verdict": ok, "external": ok, "externalFails": []},
        {"caseId": "s", "verdict": fail, "external": fail, "externalFails": [18], "failCriteria": [18]},
        {"caseId": "q", "verdict": fail, "external": fail, "externalFails": [18, 6], "failCriteria": [18, 3]},
        {"caseId": "z", "verdict": fail, "external": fail, "externalFails": [6], "failCriteria": [18]},
        # H-M1: el 6 la IA lo dejó dudoso, así que no cuenta como "same" aunque el revisor también lo marque.
        {
            "caseId": "u",
            "verdict": fail,
            "external": fail,
            "externalFails": [18, 6],
            "failCriteria": [18, 6],
            "uncertainCriteria": [6],
        },
        {"caseId": "x", "verdict": fail, "external": ok, "externalFails": [], "failCriteria": [18]},
    ]
    criteria = [3, 6, 18]
    rows = agreement.call_rows(results, {}, set(), criteria)
    by_case = {r["caseId"]: r["reasonMatch"] for r in rows}
    assert by_case == {"p": "bothPass", "s": "same", "q": "partial", "z": "none", "u": "partial", "x": None}
    out = agreement.compute_rows(rows, len(criteria))
    reasons = out["reasonMatch"]
    assert reasons == {"n": 5, "bothPass": 1, "same": 1, "partial": 2, "none": 1}
    assert reasons["n"] == out["byCall"]["agree"]
    assert [r["caseId"] for r in rows if matches(r, "agreePartial")] == ["q", "u"]
    assert [r["caseId"] for r in rows if matches(r, "agreeNone")] == ["z"]
    assert [r["caseId"] for r in rows if matches(r, "agreeNone", 6)] == ["z"]
    assert not any(matches(r, "agreeSame", 6) for r in rows)


def test_calibration_verdict_and_rejected_chips(
    client: TestClient,
    admin: User,  # noqa: F811
    imported: sessionmaker[Session],
) -> None:
    """23-modulo-de-calibracion: el veredicto de calibración se guarda como el correcto del criterio con el `outcome`
    derivado; los chips de «Criterios rechazados» llevan su calibración y los
    «Ambiguo» viejos se leen como No cumple."""
    ids = seed_tested_version(imported, admin)
    login(client, admin)
    url = "/api/admin/verifications"
    # Llamada 1, criterio 2: Qubyt No cumple, revisor Cumple. Calibrar No cumple = el revisor se equivocó.
    put = client.put(f"{url}/{ids[1]}/2", json={"verdict": "non_compliant", "version": "9.8"}).json()
    assert put["outcome"] == "reviewer_error" and put["calibration"] == "non_compliant"
    # Llamada 2, criterio 3: los dos Cumple. Calibrar No cumple = los dos se equivocaron → chip gris.
    put = client.put(f"{url}/{ids[2]}/3", json={"verdict": "non_compliant", "version": "9.8"}).json()
    assert put["outcome"] == "both_wrong"
    # Llamada 0, criterio 14: registro viejo «Ambiguo» → se lee como No cumple (AB5).
    client.put(f"{url}/{ids[0]}/14", json={"outcome": "ambiguous", "version": "9.8"})
    assert client.put(f"{url}/{ids[0]}/14", json={"version": "9.8"}).status_code == 400

    items = client.get("/api/admin/prompts/9.8/agreement/calls", params={"segment": "all"}).json()["items"]
    chips = {i["caseId"]: i["rejectedCriteria"] for i in items}
    assert chips[ids[0]] == [{"criterionId": 14, "kind": "reviewer", "calibration": "non_compliant"}]
    assert chips[ids[1]] == [{"criterionId": 2, "kind": "qubyt", "calibration": "non_compliant"}]
    assert chips[ids[2]] == [{"criterionId": 3, "kind": "calibrated", "calibration": "non_compliant"}]

    case = client.get(f"/api/admin/prompts/9.8/agreement/calls/{ids[0]}").json()
    fourteen = next(c for c in case["criteria"] if c["criterionId"] == 14)
    assert fourteen["verification"]["calibration"] == "non_compliant"

    # Calibrar Cumple el acuerdo lo deja como «los dos tienen razón» y el chip sale.
    client.put(f"{url}/{ids[2]}/3", json={"verdict": "compliant", "version": "9.8"})
    items = client.get("/api/admin/prompts/9.8/agreement/calls", params={"segment": "all"}).json()["items"]
    assert next(i for i in items if i["caseId"] == ids[2])["rejectedCriteria"] == []


def test_rejected_chips_by_who_rejects() -> None:
    row = {
        "caseId": "c",
        "result": {"externalFails": [4, 5]},
        "items": [
            {"criterionId": 2, "kind": "fp"},
            {"criterionId": 4, "kind": "agree"},
            {"criterionId": 5, "kind": "undecided"},
            {"criterionId": 6, "kind": "undecided"},
            {"criterionId": 7, "kind": "agree"},
        ],
    }
    kinds = [(c["criterionId"], c["kind"]) for c in verification.rejected_chips(row, {})]
    # El 6 (Qubyt sin veredicto, revisor Cumple) y el 7 (los dos Cumple, sin calibrar) no salen.
    assert kinds == [(2, "qubyt"), (4, "both"), (5, "reviewer")]
