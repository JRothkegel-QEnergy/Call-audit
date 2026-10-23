"""Ficha del cliente desde la metadata (Cambio 13). Datos sintéticos."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from call_audit.ingestion import customer
from call_audit.persistence.models import Case, User
from tests.conftest import login
from tests.test_api import case_id


@pytest.mark.parametrize(
    ("number", "dv", "expected"),
    [
        (12345678, 5, "12.345.678-5"),
        (9876543, "k", "9.876.543-K"),
        ("11111111-1", None, "11.111.111-1"),
        ("12.345.678", "K", "12.345.678-K"),
        ("sin rut", None, "sin rut"),
        (None, None, None),
    ],
)
def test_rut(number, dv, expected) -> None:
    assert customer.rut(number, dv) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (56987654321, "+56 9 8765 4321"),
        (987654321, "+56 9 8765 4321"),
        ("+56 9 8765 4321", "+56 9 8765 4321"),
        (22223333, "22223333"),
        ("", None),
    ],
)
def test_phone(value, expected) -> None:
    assert customer.phone(value) == expected


def test_customer_from_row_shows_raw_values_that_do_not_parse() -> None:
    row = {
        "NOMBRE": "ANA",
        "PATERNO": "PRUEBA",
        "MATENRO": "SINTETICA",
        "RUT": 12345678,
        "DV": 5,
        "FECHA_NACIMIENTO": datetime(1990, 4, 3),
        "EMAIL": "Ana.Prueba@Ejemplo.CL",
        "FONO_CONTACTO": "fono raro",
        "FLUJO": "INTENCION DE RENUNCIA",
    }
    assert customer.customer(row) == {
        "full_name": "ANA PRUEBA SINTETICA",
        "rut": "12.345.678-5",
        "birth_date": "03-04-1990",
        "email": "ana.prueba@ejemplo.cl",
        "phone": "fono raro",
        "flow": "INTENCION DE RENUNCIA",
    }
    assert customer.customer({"FECHA_NACIMIENTO": "31/02/1990"})["birth_date"] == "31/02/1990"
    assert customer.customer({"ESTADO_CALIDAD": "APROBADA"}) is None


def test_insurer_column_with_broken_n() -> None:
    assert customer.policy_metadata({"COMPA�IA": "Aseguradora Ejemplo"})["insurer"] == "Aseguradora Ejemplo"


@pytest.mark.parametrize(
    ("category", "renounceable", "retainable", "fields"),
    [
        ("RETENIBLE", "Sí", "Sí", []),
        ("RETENIBLE", "No", "Sí", ["renounceable"]),
        ("RETENIBLE", "No", "No", ["renounceable", "retainable"]),
        ("NO RETENIBLE", "Sí", "Sí", ["retainable"]),
        ("NO_RETENIBLE", "Sí", "No", []),
        ("IRRENUNCIABLE", "Sí", None, ["renounceable"]),
        ("NO_RENUNCIABLE_CANAL", "No", "Sí", []),
        ("RETENIBLE", "Tal vez", None, []),
        ("OTRA", "No", "No", []),
    ],
)
def test_category_mismatch(category, renounceable, retainable, fields) -> None:
    assert [m["field"] for m in customer.category_mismatch(category, renounceable, retainable)] == fields


def test_enrich_sheet_is_idempotent() -> None:
    row = {"TIPO_SEGURO": "MUS", "RENUNCIABLE": "NO", "RETENIBLE": "SI"}
    sheet = {"productId": "P1", "category": "RETENIBLE", "callData": [{"label": "Plan", "value": "A"}]}
    once = customer.enrich_sheet(sheet, row, has_product=True)
    twice = customer.enrich_sheet(once, row, has_product=True)
    assert once == twice
    assert [r["label"] for r in once["callData"]] == ["Plan", "Tipo de seguro"]
    assert once["customerCategory"] == {"renounceable": "No", "retainable": "Sí"}
    assert once["categoryMismatch"] == [{"field": "renounceable", "metadata": "No"}]
    # Sin ficha del catálogo no hay contra qué comparar.
    assert customer.enrich_sheet(sheet, row, has_product=False)["categoryMismatch"] == []


def test_detail_has_customer_for_every_role_but_not_in_model_input(client: TestClient, users: dict[str, User]) -> None:
    for role in ("auditor_io", "supervisor"):
        login(client, users[role])
        case = client.get(f"/api/cases/{case_id(client, '1002')}").json()
        assert case["customer"]["fullName"] == "Persona Inventada"
        assert case["customer"]["rut"] == "11.111.111-1"
        assert case["customer"]["phone"] == "+56 9 8765 4321"
        assert case["customer"]["email"] is None
        # El modelo nunca recibió estos datos: el panel del modelo no los muestra.
        fields = {r["field"] for s in case["modelRuns"][0]["inputData"] for r in s["rows"]}
        assert not fields & {"full_name", "rut", "birth_date", "email", "phone", "RUT", "NOMBRE"}
        client.post("/api/auth/logout")


def test_auditor_never_gets_client_verdict_or_comment(client: TestClient, users: dict[str, User]) -> None:
    login(client, users["auditor"])
    case = client.get(f"/api/cases/{case_id(client, '1002')}").json()
    assert case["customer"] is not None
    assert case["externalComment"] is None
    assert case["externalQualityVerdict"] is None
    assert "ESTADO_CALIDAD" not in str(case) and "COMENTARIO" not in str(case)


def test_backfill_fills_existing_calls_without_touching_runs(imported: sessionmaker[Session]) -> None:
    with imported() as session, session.begin():
        case = session.scalar(select(Case).where(Case.call_id == "1002"))
        case.call_metadata = {k: v for k, v in case.call_metadata.items() if k != "customer"}
        runs_before = [(r.model, r.run_label, r.findings) for r in case.runs]
        recording = case.recording
    rows = {recording: {"NOMBRE": "OTRA", "PATERNO": "PERSONA", "RENUNCIABLE": "SI", "RETENIBLE": "SI"}}
    with imported() as session, session.begin():
        updated, missing = customer.backfill(session, rows)
    assert updated == 1 and missing >= 1
    with imported() as session:
        case = session.scalar(select(Case).where(Case.call_id == "1002"))
        assert case.call_metadata["customer"]["full_name"] == "OTRA PERSONA"
        assert case.product_sheets[0]["customerCategory"] == {"renounceable": "Sí", "retainable": "Sí"}
        assert [(r.model, r.run_label, r.findings) for r in case.runs] == runs_before
