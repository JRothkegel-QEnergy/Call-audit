"""Catálogo de seguros versionado (Cambio 11): carga inicial, versiones, duplicados, extracción de Excel con un
doble de la IA y endpoints del supervisor con permiso manage_catalog. Datos 100 % sintéticos."""

import io
import json

import openpyxl
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from call_audit.catalog import store, uploads
from call_audit.catalog.extract import UploadError, check_file
from call_audit.catalog.schema import CatalogProduct
from call_audit.persistence.models import Product, User
from tests.conftest import login

LEGACY = {
    "source": "sintético",
    "payment_methods": {"CCT": "Cuenta corriente"},
    "procedures": [],
    "products": [
        {
            "id": "P01",
            "system_names": ["SEGURO FICTICIO"],
            "name": "Seguro Ficticio",
            "insurer": "Aseguradora Uno",
            "category": "RETENIBLE",
            "premium_type": "mensual",
            "policies": "MUS 11-1111-1100 / Salesforce 11-1111-2200",
            "premium_refund": "No",
            "coverages": [
                {"name": "Muerte accidental", "amount": "UF 100", "detail": "A herederos", "beneficiary": None}
            ],
            "assistances": [],
            "premiums": [],
            "claims": [],
            "temporary_disability_table": [],
            "observations": [],
        },
        {
            "id": None,
            "system_names": ["SEGURO OBLIGATORIO X"],
            "name": "Seguro Obligatorio X",
            "insurer": "Aseguradora Dos",
            "category": "NO_RENUNCIABLE_OBLIGATORIO",
            "premium_type": "sin_dato",
        },
    ],
}


@pytest.fixture
def catalog(db: sessionmaker[Session]) -> sessionmaker[Session]:
    with db() as session, session.begin():
        store.seed(session, LEGACY)
    return db


def product(**changes) -> CatalogProduct:
    return CatalogProduct.model_validate(
        {"name": "Seguro Nuevo", "insurer": "Aseguradora Uno", "category": "RETENIBLE"} | changes
    )


def test_seed_keeps_prompt_format(catalog: sessionmaker[Session]) -> None:
    with catalog() as session:
        snap = store.snapshot(session)
        assert snap["payment_methods"] == {"CCT": "Cuenta corriente"}
        # Lo que leen render.py y catalog_match.py no cambia: las pólizas vuelven a ser texto y sin ficha no hay id.
        p01 = next(p for p in snap["products"] if p["catalog_id"] == "P01")
        assert p01["id"] == "P01" and p01["version"] == 1
        assert p01["policies"] == "11-1111-1100 / 11-1111-2200"
        other = next(p for p in snap["products"] if p["catalog_id"] != "P01")
        assert other["id"] is None and other["catalog_id"].startswith("C")
        stored = store.current(session.get(Product, "P01")).data
        assert stored["policies"] == ["11-1111-1100", "11-1111-2200"]
        assert stored["policies_note"] == "MUS 11-1111-1100 / Salesforce 11-1111-2200"


def test_key_is_name_plus_insurer(catalog: sessionmaker[Session]) -> None:
    with catalog() as session, session.begin():
        # Mismo nombre en otra aseguradora es otro seguro; con la misma aseguradora (sin tildes ni mayúsculas) choca.
        store.create_product(
            session, product(name="Seguro Ficticio", insurer="Aseguradora Tres"), {"kind": "manual"}, None
        )
        with pytest.raises(store.DuplicateKeyError):
            store.create_product(
                session, product(name="SEGURO  FICTÍCIO", insurer="aseguradora uno"), {"kind": "manual"}, None
            )


def test_versions_never_overwrite(catalog: sessionmaker[Session]) -> None:
    with catalog() as session, session.begin():
        p = session.get(Product, "P01")
        data = CatalogProduct.model_validate(store.current(p).data | {"premium_refund": "Sí, proporcional"})
        store.save_version(session, p, data, {"kind": "manual"}, None, base_version=1)
        assert p.current_version == 2 and [v.version for v in p.versions] == [1, 2]
        assert p.versions[0].data["premium_refund"] == "No"
        with pytest.raises(store.VersionConflictError):
            store.save_version(session, p, data, {"kind": "manual"}, None, base_version=1)
        changes = store.diff(p.versions[0].data, p.versions[1].data)
        assert [(c["path"], c["kind"]) for c in changes] == [("premiumRefund", "changed")]


def test_merge_keeps_existing_and_unions_lists() -> None:
    existing = {"name": "A", "policies": ["1"], "premium_refund": "No", "withdrawal": "10 días"}
    proposed = {"name": "A", "policies": ["2"], "premium_refund": None, "withdrawal": "15 días"}
    merged = store.merge(existing, proposed)
    assert merged["policies"] == ["1", "2"] and merged["premium_refund"] == "No" and merged["withdrawal"] == "15 días"
    assert store.merge(existing, proposed, {"withdrawal": "keep"})["withdrawal"] == "10 días"


def xlsx(rows: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Productos"
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


EXCEL = xlsx(
    [
        ["Nombre", "Compañía", "Póliza", "Devolución"],
        ["Seguro Ficticio", "Aseguradora Uno", "11-1111-1100", "Sí"],
        ["Seguro Nuevo", "Aseguradora Uno", "11-1111-2200", "No"],
    ]
)


def fake_llm(system: str, user: str):
    """Doble de la IA: primero lista los seguros, después devuelve sus fichas."""
    if '"products": [{"name"' in system:
        listing = {
            "products": [
                {"name": "Seguro Ficticio", "insurer": "Aseguradora Uno"},
                {"name": "Seguro Nuevo", "insurer": "Aseguradora Uno"},
            ],
            "unused_sheets": [],
        }
        return listing, "modelo-falso", 0.001, json.dumps(listing)
    products = {
        "products": [
            {
                "product": {
                    "name": "Seguro Ficticio",
                    "insurer": "Aseguradora Uno",
                    "category": "RETENIBLE",
                    "policies": ["11-1111-1100"],
                    "premium_refund": "Sí",
                },
                "sources": {"premium_refund": {"sheet": "Productos", "row": 2, "raw": "Sí"}},
                "missing": [],
            },
            # Comparte la póliza 11-1111-2200 con P01 (posible duplicado) y trae un RUT en las notas (dato personal).
            {
                "product": {
                    "name": "Seguro Nuevo",
                    "insurer": "Aseguradora Uno",
                    "category": "RETENIBLE",
                    "policies": ["11-1111-2200"],
                    "notes": "Contacto 12.345.678-9",
                },
                "sources": {},
                "missing": ["withdrawal"],
            },
        ]
    }
    return products, "modelo-falso", 0.002, json.dumps(products)


def test_check_file_rejects_before_spending() -> None:
    with pytest.raises(UploadError, match="invalid_format"):
        check_file("pauta.csv", b"a;b")
    with pytest.raises(UploadError) as exc:
        check_file("pauta.xlsx", b"\xd0\xcf\x11\xe0" + b"0" * 10)
    assert exc.value.code == "password_protected"
    check_file("pauta.xlsx", EXCEL)


@pytest.fixture
def manager(catalog: sessionmaker[Session], users: dict[str, User]) -> User:
    with catalog() as session, session.begin():
        user = session.get(User, users["supervisor"].id)
        user.permissions = ["view_model_io", "manage_catalog"]
    return users["supervisor"]


@pytest.fixture
def api(catalog: sessionmaker[Session], manager: User):
    from call_audit.api.app import create_app
    from call_audit.persistence.db import get_session

    app = create_app()

    def session_override():
        with catalog() as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    with TestClient(app) as client:
        login(client, manager)
        yield client


def upload(api: TestClient, catalog: sessionmaker[Session]) -> dict:
    response = api.post("/api/catalog/uploads", content=EXCEL, headers={"X-File-Name": "pauta%20nueva.xlsx"})
    assert response.status_code == 200, response.text
    upload_id = response.json()["uploadId"]
    assert uploads.process_pending(catalog, llm=fake_llm) == 1
    return api.get(f"/api/catalog/uploads/{upload_id}").json()


def test_upload_proposes_and_detects_existing(api: TestClient, catalog: sessionmaker[Session]) -> None:
    data = upload(api, catalog)
    assert data["status"] == "ready" and data["fileName"] == "pauta nueva.xlsx"
    assert data["model"] == "modelo-falso" and data["extractionPromptVersion"] and data["schemaVersion"]
    existing, new = data["items"]
    assert existing["match"]["status"] == "exists" and existing["match"]["state"] == "changed"
    assert existing["match"]["productId"] == "P01"
    assert [c["path"] for c in existing["match"]["changes"]] == ["premiumRefund"]
    assert existing["fieldSources"]["premiumRefund"]["row"] == 2
    assert new["match"] == {"status": "new"}
    kinds = {w["kind"] for w in new["warnings"]}
    assert {"possible_duplicate", "possible_personal_data"} <= kinds
    assert new["missingFields"] == ["withdrawal"]
    assert data["counts"]["new"] == 1 and data["counts"]["existsChanged"] == 1


def test_decisions_create_versions(api: TestClient, catalog: sessionmaker[Session]) -> None:
    data = upload(api, catalog)
    existing, new = data["items"]
    uid = data["id"]
    # El supervisor quita el RUT de las notas: la advertencia de dato personal desaparece.
    edited = new["proposed"] | {"notes": "Sin contacto"}
    item = api.put(f"/api/catalog/uploads/{uid}/items/{new['id']}", json={"proposed": edited}).json()
    assert "possible_personal_data" not in {w["kind"] for w in item["warnings"]}
    created = api.post(f"/api/catalog/uploads/{uid}/items/{new['id']}/decision", json={"action": "create"})
    assert created.status_code == 200, created.text
    updated = api.post(f"/api/catalog/uploads/{uid}/items/{existing['id']}/decision", json={"action": "update"}).json()
    assert updated["decision"]["action"] == "updated" and updated["decision"]["version"] == 2
    p01 = api.get("/api/catalog/products/P01").json()
    assert p01["product"]["premiumRefund"] == "Sí" and p01["version"] == 2
    history = api.get("/api/catalog/products/P01/versions").json()
    assert history[0]["origin"]["kind"] == "upload" and history[-1]["origin"]["kind"] == "initial_load"
    assert api.get(f"/api/catalog/uploads/{uid}").json()["status"] == "closed"


def test_edit_conflicts_and_permissions(
    api: TestClient, catalog: sessionmaker[Session], users: dict[str, User]
) -> None:
    detail = api.get("/api/catalog/products/P01").json()
    body = {"product": detail["product"] | {"withdrawal": "10 días"}, "baseVersion": 1}
    assert api.put("/api/catalog/products/P01", json=body).json()["version"] == 2
    assert api.put("/api/catalog/products/P01", json=body).json()["detail"] == "version_conflict"
    other = next(p for p in api.get("/api/catalog/products").json() if p["id"] != "P01")
    clash = {"product": detail["product"] | {"name": other["name"], "insurer": other["insurer"]}, "baseVersion": 2}
    response = api.put("/api/catalog/products/P01", json=clash)
    assert response.status_code == 409 and response.json()["detail"] == "duplicate_key"
    assert api.post("/api/catalog/products/P01/status", json={"status": "archived"}).status_code == 204
    assert [p["id"] for p in api.get("/api/catalog/products").json()] == [other["id"]]
    assert api.get("/api/catalog/products?query=11111100&status=all").json()[0]["id"] == "P01"
    with catalog() as session, session.begin():
        session.get(User, users["supervisor"].id).permissions = ["view_model_io"]
    assert api.get("/api/catalog/products").status_code == 403


def test_bad_file_is_rejected(api: TestClient) -> None:
    response = api.post("/api/catalog/uploads", content=b"a;b", headers={"X-File-Name": "pauta.csv"})
    assert response.status_code == 400 and response.json()["detail"] == "invalid_format"


def test_v1_1_fields_are_stored_but_not_sent_to_prompt(db: sessionmaker[Session]) -> None:
    item = LEGACY["products"][0] | {
        "exclusions": [{"type": "Negocio no asegurable", "detail": "Discotecas"}],
        "credit_rates": [
            {"coverage": "Desgravamen", "term_from": 1, "term_to": 12, "net_rate": 0.5, "vat": 0.1, "gross_rate": 0.6}
        ],
        "max_age_by_term": [{"term_from": 1, "term_to": 12, "max_age": "74 años"}],
    }
    with db() as session, session.begin():
        store.seed(session, LEGACY | {"products": [item], "market_comparison": [{"Segmento": "Desempleo"}]})
    with db() as session:
        stored = store.current(session.get(Product, "P01")).data
        assert stored["exclusions"][0]["detail"] == "Discotecas"
        assert stored["credit_rates"][0]["term_to"] == "12"  # los números del Excel quedan como texto
        snap = store.snapshot(session)
        assert snap["market_comparison"] == [{"Segmento": "Desempleo"}]
        assert not {"exclusions", "credit_rates", "max_age_by_term"} & set(snap["products"][0])
