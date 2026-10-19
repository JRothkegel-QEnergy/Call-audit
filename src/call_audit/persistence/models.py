"""Tablas de la API delgada sobre las corridas del bench.

Las salidas del modelo, la transcripción y las fichas van en columnas JSON: la API las devuelve tal cual y todavía
no hay consultas por dentro de ellas.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
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
    role: Mapped[str] = mapped_column(String(20))  # auditor | supervisor
    permissions: Mapped[list[Any]] = mapped_column(default=list)
    password_hash: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="active")  # invited | active | deactivated
    created_at: Mapped[datetime] = mapped_column(default=now)


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    team: Mapped[str] = mapped_column(String(200), default="")


class PromptVersion(Base):
    """System prompt compartido por todas las llamadas de una versión."""

    __tablename__ = "prompt_versions"

    version: Mapped[str] = mapped_column(String(20), primary_key=True)
    system_text: Mapped[str] = mapped_column(Text)


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
    """Registro de accesos a datos de ejecutivos (D-13, L-18)."""

    __tablename__ = "access_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50))
    target: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(default=now)
