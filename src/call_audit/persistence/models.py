"""Tablas de la API delgada sobre las corridas del bench.

Las salidas del modelo, la transcripción y las fichas van en columnas JSON: la API las devuelve tal cual y todavía
no hay consultas por dentro de ellas.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def new_id() -> str:
    return uuid.uuid4().hex


def now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[Any]: JSON, datetime: DateTime(timezone=True)}


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20))  # auditor | supervisor | qubico_admin (Cambio 12)
    permissions: Mapped[list[Any]] = mapped_column(default=list)
    password_hash: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="active")  # invited | active | deactivated
    created_at: Mapped[datetime] = mapped_column(default=now)
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    last_login_at: Mapped[datetime | None] = mapped_column()
    # Invitación o restablecimiento de contraseña por correo (Cambio 12, D-36): solo se guarda el hash del enlace.
    invite_token_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    invite_expires_at: Mapped[datetime | None] = mapped_column()
    invite_kind: Mapped[str | None] = mapped_column(String(10))  # invite | reset
    invite_used_at: Mapped[datetime | None] = mapped_column()

    created_by: Mapped["User | None"] = relationship(remote_side=[id], foreign_keys=[created_by_id])


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    team: Mapped[str] = mapped_column(String(200), default="")


class PromptVersion(Base):
    """Registro inmutable de versiones del prompt de la capa 2 (Cambio 12, D-26/D-33).

    `system_text` es el system prompt tal como se envía al modelo. Las versiones que importó el bench quedan con
    source="bench" y status="retired". Desde "testing" la versión no se edita: cualquier cambio es otra versión.
    """

    __tablename__ = "prompt_versions"

    version: Mapped[str] = mapped_column(String(20), primary_key=True)
    system_text: Mapped[str] = mapped_column(Text)
    # draft | testing | test_failed | tested | active | retired
    status: Mapped[str] = mapped_column(String(20), default="retired")
    source: Mapped[str] = mapped_column(String(10), default="bench")  # yaml | text | bench | repo
    spec_yaml: Mapped[str | None] = mapped_column(Text)
    schema_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    model: Mapped[str] = mapped_column(String(100), default="")
    changelog: Mapped[str] = mapped_column(Text, default="")
    rationale: Mapped[str | None] = mapped_column(Text)
    history: Mapped[list[Any]] = mapped_column(default=list)  # [{"at", "actor", "action"}]
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime | None] = mapped_column(default=now)
    tested_at: Mapped[datetime | None] = mapped_column()
    activated_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    activated_at: Mapped[datetime | None] = mapped_column()
    activation_reason: Mapped[str | None] = mapped_column(Text)
    retired_at: Mapped[datetime | None] = mapped_column()

    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_id])
    activated_by: Mapped[User | None] = relationship(foreign_keys=[activated_by_id])


class PromptEvaluation(Base):
    """Prueba de una versión del prompt contra la referencia (Cambio 12 §4.2). La corre el worker."""

    __tablename__ = "prompt_evaluations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    version: Mapped[str] = mapped_column(ForeignKey("prompt_versions.version"))
    model: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | running | done | failed | stopped
    requested_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    stopped_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    case_ids: Mapped[list[Any]] = mapped_column(default=list)
    done: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    results: Mapped[list[Any]] = mapped_column(default=list)  # una entrada por llamada probada
    metrics: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=now)
    started_at: Mapped[datetime | None] = mapped_column()
    finished_at: Mapped[datetime | None] = mapped_column()

    requested_by: Mapped[User] = relationship(foreign_keys=[requested_by_id])
    stopped_by: Mapped[User | None] = relationship(foreign_keys=[stopped_by_id])


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    call_id: Mapped[str] = mapped_column(String(64), unique=True)
    recording: Mapped[str] = mapped_column(String(200))
    call_date: Mapped[str] = mapped_column(String(10))
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"))
    duration_ms: Mapped[int] = mapped_column(Integer)
    products: Mapped[list[Any]] = mapped_column(default=list)
    product_sheets: Mapped[list[Any]] = mapped_column(default=list)
    transcript: Mapped[list[Any]] = mapped_column(default=list)
    call_metadata: Mapped[dict[str, Any]] = mapped_column(default=dict)
    # Veredicto y comentario del auditor del cliente (ESTADO_CALIDAD, COMENTARIO): solo para supervisor (D-24).
    external_verdict: Mapped[str | None] = mapped_column(String(20))
    external_comment: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    queued_at: Mapped[datetime] = mapped_column(default=now)
    assigned_auditor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    locked_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))

    agent: Mapped[Agent] = relationship()
    locked_by: Mapped[User | None] = relationship(foreign_keys=[locked_by_id])
    runs: Mapped[list["ModelRun"]] = relationship(back_populates="case", order_by="ModelRun.run_at")


class ModelRun(Base):
    __tablename__ = "model_runs"
    __table_args__ = (UniqueConstraint("case_id", "model", "run_label"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    model: Mapped[str] = mapped_column(String(100))
    # Nombre de la corrida en el bench (ej. "v2.7", "v2.7 corrida 2").
    run_label: Mapped[str] = mapped_column(String(100))
    # La corrida vigente es la que define el veredicto del motor y los hallazgos del caso.
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    prompt_version: Mapped[str] = mapped_column(String(20))
    rubric_version: Mapped[str] = mapped_column(String(20))
    run_at: Mapped[datetime] = mapped_column(default=now)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    verdict: Mapped[str] = mapped_column(String(20))  # compliant | non_compliant | uncertain
    minor_only: Mapped[bool] = mapped_column(Boolean, default=False)
    applied_rule: Mapped[str] = mapped_column(Text, default="")
    findings: Mapped[list[Any]] = mapped_column(default=list)
    input_data: Mapped[list[Any]] = mapped_column(default=list)
    user_prompt: Mapped[str] = mapped_column(Text, default="")
    raw_response: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    # Fichas usadas en la validación: [{"productId": "P01", "version": 3}] (Cambio 11, D-29). Vacío en las corridas
    # del bench, que leían products.json sin versión.
    catalog_refs: Mapped[list[Any]] = mapped_column(default=list)

    case: Mapped[Case] = relationship(back_populates="runs")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), unique=True)
    auditor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    items: Mapped[list[Any]] = mapped_column(default=list)
    bad_transcript_turns: Mapped[list[Any]] = mapped_column(default=list)
    final_verdict: Mapped[str] = mapped_column(String(20))
    review_seconds: Mapped[int] = mapped_column(Integer, default=0)
    submitted_at: Mapped[datetime] = mapped_column(default=now)
    approved_at: Mapped[datetime | None] = mapped_column()

    auditor: Mapped[User] = relationship()


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    scope: Mapped[str] = mapped_column(String(10))  # case | finding
    criterion_id: Mapped[int | None] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=now)
    edited_at: Mapped[datetime | None] = mapped_column()

    author: Mapped[User] = relationship()


class DiscrepancyClassification(Base):
    """Clasificación del supervisor en el árbol de discrepancias con el cliente (Cambio 09 §4)."""

    __tablename__ = "discrepancy_classifications"

    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), primary_key=True)
    classification: Mapped[str | None] = mapped_column(String(20))  # ai_correct | ai_wrong
    criterion_ids: Mapped[list[Any]] = mapped_column(default=list)
    note: Mapped[str] = mapped_column(Text, default="")
    presentation: Mapped[str | None] = mapped_column(String(20))  # pending | presented
    updated_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(default=now)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    kind: Mapped[str] = mapped_column(String(30))  # escalation | critical_confirmed
    status: Mapped[str] = mapped_column(String(10), default="new")
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    criterion_id: Mapped[int | None] = mapped_column(Integer)
    at_ms: Mapped[int | None] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(200))
    comment: Mapped[str | None] = mapped_column(Text)
    raised_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=now)
    handled_comment: Mapped[str | None] = mapped_column(Text)

    case: Mapped[Case] = relationship()
    raised_by: Mapped[User] = relationship()


class AccessLog(Base):
    """Registro de actividad inmutable (D-13, L-18; Cambio 12 §4.4): accesos a datos de ejecutivos, cuentas,
    versiones del prompt y catálogo. No se edita ni se borra."""

    __tablename__ = "access_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50))
    target: Mapped[str] = mapped_column(String(100))
    details: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(default=now)

    user: Mapped[User] = relationship()


class Product(Base):
    """Seguro del catálogo (Cambio 11). La ficha vive en ProductVersion; nunca se sobrescribe ni se borra."""

    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # P01, H05, ... (nuevos: C0001, ...)
    # Clave única: nombre normalizado + aseguradora (D-27). Se recalcula al guardar una versión.
    key: Mapped[str] = mapped_column(String(400), unique=True)
    status: Mapped[str] = mapped_column(String(10), default="active")  # active | archived
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(default=now)
    updated_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))

    versions: Mapped[list["ProductVersion"]] = relationship(back_populates="product", order_by="ProductVersion.version")
    updated_by: Mapped[User | None] = relationship()


class ProductVersion(Base):
    __tablename__ = "product_versions"
    __table_args__ = (UniqueConstraint("product_id", "version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    version: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict[str, Any]] = mapped_column()  # CatalogProduct en snake_case
    schema_version: Mapped[str] = mapped_column(String(20))
    # {"kind": "initial_load" | "upload" | "manual" | "restore" | "status", ...}
    origin: Mapped[dict[str, Any]] = mapped_column()
    note: Mapped[str | None] = mapped_column(Text)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=now)

    product: Mapped[Product] = relationship(back_populates="versions")
    author: Mapped[User | None] = relationship()


class CatalogReference(Base):
    """Datos de referencia del catálogo que no se editan en la app (medios de pago, procedimientos; D7)."""

    __tablename__ = "catalog_reference"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    data: Mapped[dict[str, Any]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=now)


class CatalogUpload(Base):
    """Excel subido por un supervisor: la IA propone fichas (items) y el supervisor decide cada una."""

    __tablename__ = "catalog_uploads"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    file_name: Mapped[str] = mapped_column(String(255))
    file_size: Mapped[int] = mapped_column(Integer)
    # El Excel original (máx. 10 MB, D3). Se borra al descartar la carga (L-35).
    content: Mapped[bytes | None] = mapped_column(LargeBinary)
    status: Mapped[str] = mapped_column(String(20), default="processing")
    step: Mapped[str | None] = mapped_column(String(20), default="reading")
    error: Mapped[str | None] = mapped_column(String(40))
    error_detail: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(100), default="")
    extraction_prompt_version: Mapped[str] = mapped_column(String(20), default="")
    schema_version: Mapped[str] = mapped_column(String(20), default="")
    unused_sheets: Mapped[list[Any]] = mapped_column(default=list)
    items: Mapped[list[Any]] = mapped_column(default=list)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    raw_response: Mapped[str | None] = mapped_column(Text)
    uploaded_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(default=now)
    updated_at: Mapped[datetime] = mapped_column(default=now)

    uploaded_by: Mapped[User] = relationship()
