"""Fixtures: base SQLite temporal, usuarios y una corrida del bench 100 % sintética."""

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from call_audit.api.app import create_app
from call_audit.config import get_settings
from call_audit.ingestion.import_bench import import_run
from call_audit.persistence.db import get_session, make_engine
from call_audit.persistence.models import Base, User
from call_audit.rubric import Rubric, load_rubric

PASSWORD = "clave-de-prueba-123"

CALLS = {
    # recording: (call_id, veredicto del cliente, criterios del modelo, esperas)
    "rec_aprueba": ("1001", "APROBADA", [(30, "cumple")], [12]),
    "rec_rechaza_ia": ("1002", "APROBADA", [(30, "incumple"), (8, "cumple")], [5]),
    "rec_coincide": ("1003", "RECHAZADA", [(12, "incumple")], []),
}


@pytest.fixture
def rubric() -> Rubric:
    return load_rubric(get_settings().rubric_path)


@pytest.fixture
def db(tmp_path: Path) -> Iterator[sessionmaker[Session]]:
    engine = make_engine(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    Base.metadata.create_all(engine)
    yield sessionmaker(engine, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def users(db: sessionmaker[Session]) -> dict[str, User]:
    hasher = PasswordHasher()
    accounts = {
        "auditor": User(
            email="auditora@ejemplo.cl",
            name="Auditora",
            role="auditor",
            permissions=[],
            password_hash=hasher.hash(PASSWORD),
        ),
        "auditor_io": User(
            email="externa@ejemplo.cl",
            name="Externa",
            role="auditor",
            permissions=["view_model_io"],
            password_hash=hasher.hash(PASSWORD),
        ),
        "supervisor": User(
            email="super@ejemplo.cl",
            name="Supervisor",
            role="supervisor",
            permissions=["view_model_io"],
            password_hash=hasher.hash(PASSWORD),
        ),
    }
    with db() as session, session.begin():
        session.add_all(accounts.values())
    return accounts


def row_for(recording: str, call_id: str, external: str) -> dict:
    return {
        "ID": call_id,
        "ESTADO_CALIDAD": external,
        "COMENTARIO": "Llamó desde el 987654321 y no se validó" if call_id == "1002" else None,
        "EJECUTIVO": "Ejecutivo Ficticio",
        "TIPIFICACION": "RETENCION",
        "MOTIVO RENUNCIA": "Problemas Económicos",
        "RUT": "11111111-1",
        "FONO_CONTACTO": "987654321",
        "NOMBRE": "Persona",
        "PATERNO": "Inventada",
        "MATENRO": "",
        "FECHA_NACIMIENTO": None,
        "NUM_POLIZA": "123",
        "NUM_MUS_ANETO": "999",
    }


@pytest.fixture
def bench_dir(tmp_path: Path) -> tuple[Path, dict[str, dict]]:
    out = tmp_path / "bench"
    (out / "calls").mkdir(parents=True)
    (out / "prompts").mkdir()
    model_dir = out / "results" / "modelo-a"
    model_dir.mkdir(parents=True)
    (out / "prompts" / "system.txt").write_text("Eres un auditor (sintético).", encoding="utf-8")
    (out / "prompts" / "prompt_version.txt").write_text("9.9\n", encoding="utf-8")
    rows = {}
    for recording, (call_id, external, criteria, holds) in CALLS.items():
        rows[recording] = row_for(recording, call_id, external)
        stem = f"call_{call_id}"
        call = {
            "call_id": call_id,
            "metadata": {
                "date": "2026-10-01",
                "agent_id": f"EJ-{call_id}",
                "duration_sec": 240,
                "holds_sec": holds,
                "policies": [{"name": "Seguro Ficticio", "mus_a_neto": "999", "plan": "Plan A", "premium": "UF 0,5"}],
            },
            "description": "4 min · ficha: P99 (nombre, 1.00)",
            "audio_href": f"../../asr_bench/{recording}/viewer.html",
            "transcript": [
                {"channel": "agent", "start_ms": 0, "text": "Buenos días, le habla la ejecutiva."},
                {"channel": "customer", "start_ms": 4000, "text": "Quiero renunciar al seguro."},
            ],
        }
        (out / "calls" / f"{stem}.json").write_text(json.dumps(call), encoding="utf-8")
        (out / "prompts" / f"{stem}.txt").write_text(
            "## Transcripción\n[00:00] AGENTE: Buenos días, le habla la ejecutiva.\n"
            "[00:04] CLIENTE: Quiero renunciar al seguro.\n",
            encoding="utf-8",
        )
        audit = {
            "resumen": "Sintético",
            "informacion_seguro": {"estado": "OK"},
            "criterios": [
                {
                    "id": cid,
                    "estado": state,
                    "confianza": 0.9,
                    "comentario": f"motivo {cid}",
                    "evidencia": [{"t": "00:04", "hablante": "CLIENTE", "cita": "Quiero renunciar al seguro."}],
                }
                for cid, state in criteria
            ],
        }
        (model_dir / f"{stem}.json").write_text(json.dumps(audit, ensure_ascii=False), encoding="utf-8")
        (model_dir / f"{stem}.meta.json").write_text(
            json.dumps({"cost_usd": 0.01, "latency_ms": 1200, "run_at": "2026-10-15T12:00:00+00:00"}), encoding="utf-8"
        )
    return out, rows


CATALOG = {
    "products": [
        {
            "id": "P99",
            "name": "Seguro Ficticio",
            "insurer": "Aseguradora Ejemplo",
            "category": "RETENIBLE",
            "premium_mode": "Mensual",
            "premium_refund": "No",
            "withdrawal": "10 días",
            "coverages": [{"name": "Muerte accidental", "amount": "UF 100", "detail": "A herederos."}],
        }
    ]
}


@pytest.fixture
def imported(db: sessionmaker[Session], bench_dir: tuple[Path, dict], rubric: Rubric) -> sessionmaker[Session]:
    out, rows = bench_dir
    with db() as session, session.begin():
        import_run(session, out, rows, CATALOG, rubric, "v9.9", current_model="modelo-a")
    return db


@pytest.fixture
def client(imported: sessionmaker[Session], users: dict[str, User]) -> Iterator[TestClient]:
    app = create_app()

    def session_override() -> Iterator[Session]:
        with imported() as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, user: User) -> None:
    response = client.post("/api/auth/login", json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200, response.text
