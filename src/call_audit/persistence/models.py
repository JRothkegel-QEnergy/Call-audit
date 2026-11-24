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
    role: Mapped[str] = mapped_column(
        String(20)
    )  # auditor | supervisor | qubico_admin | qubico_viewer | qubico_verifier
    permissions: Mapped[list[Any]] = mapped_column(default=list)
    password_hash: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="active")  # invited | active | deactivated | deleted
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
    # "test" (o None en las anteriores): la prueba de la versión en validación, la que se muestra y la cambia de
    # estado. "train": una pasada del loop de mejora sobre entrenamiento (docs/plan-loop-prompt.md), no la toca.
    purpose: Mapped[str | None] = mapped_column(String(20))
    split: Mapped[str | None] = mapped_column(String(10))
    loop_id: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(default=now)
    started_at: Mapped[datetime | None] = mapped_column()
    finished_at: Mapped[datetime | None] = mapped_column()

    requested_by: Mapped[User] = relationship(foreign_keys=[requested_by_id])
    stopped_by: Mapped[User | None] = relationship(foreign_keys=[stopped_by_id])


class DiscrepancyAnalysis(Base):
    """Corrida de la IA de análisis de discrepancias sobre la corrida vigente (Cambio 16). La corre el worker."""

    __tablename__ = "discrepancy_analyses"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | running | done | failed | stopped
    model: Mapped[str] = mapped_column(String(100))
    analysis_prompt_version: Mapped[str] = mapped_column(String(20))
    # Serie de la capa 2 analizada (la vigente al lanzar): {"model", "promptVersion", "runLabel"}.
    layer2_series: Mapped[dict[str, Any]] = mapped_column(default=dict)
    criteria: Mapped[list[Any]] = mapped_column(default=list)
    done_criteria: Mapped[list[Any]] = mapped_column(default=list)
    # Motivos que fallaron: [{"criterionId", "error"}]. No cortan los demás.
    failed_criteria: Mapped[list[Any]] = mapped_column(default=list)
    # Resumen de la IA por motivo: {"25": "…"}.
    summaries: Mapped[dict[str, Any]] = mapped_column(default=dict)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text)
    # Con prueba de origen, analiza sus resultados en vez de la corrida vigente (loop de mejora). purpose "rules"
    # (o None): sus propuestas van a la bandeja; "attribution": solo atribuye la causa de cada desacuerdo de
    # validación, y sus propuestas nunca entran a la bandeja (R-11 de docs/ux/admin-prompt-metrics).
    source_evaluation_id: Mapped[str | None] = mapped_column(ForeignKey("prompt_evaluations.id"))
    purpose: Mapped[str | None] = mapped_column(String(20))
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    stopped_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=now)
    started_at: Mapped[datetime | None] = mapped_column()
    finished_at: Mapped[datetime | None] = mapped_column()

    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id])
    stopped_by: Mapped[User | None] = relationship(foreign_keys=[stopped_by_id])


class PromptLoop(Base):
    """Loop de mejora del prompt (docs/plan-loop-prompt.md): vueltas de prueba en entrenamiento → análisis → reglas
    aprobadas por el admin → versión nueva → prueba y atribución en validación. Lo avanza el worker."""

    __tablename__ = "prompt_loops"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    # running | waiting_approval | done | stopped | failed
    status: Mapped[str] = mapped_column(String(20), default="running")
    base_version: Mapped[str] = mapped_column(String(20))
    max_rounds: Mapped[int] = mapped_column(Integer, default=3)
    analysis_model: Mapped[str] = mapped_column(String(100))
    # Una entrada por vuelta: {"round", "version", "trainEvalId", "trainAnalysisId", "nextVersion", "valEvalId",
    # "valAnalysisId"}.
    rounds: Mapped[list[Any]] = mapped_column(default=list)
    error: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=now)
    finished_at: Mapped[datetime | None] = mapped_column()

    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id])


class DiscrepancyPattern(Base):
    """Patrón (u observación) que devolvió la IA de análisis para un motivo, con los casos tal como estaban."""

    __tablename__ = "discrepancy_patterns"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    analysis_id: Mapped[str] = mapped_column(ForeignKey("discrepancy_analyses.id"), index=True)
    criterion_id: Mapped[int] = mapped_column(Integer)
    rank: Mapped[int] = mapped_column(Integer, default=0)
    impact: Mapped[float] = mapped_column(Float, default=0.0)
    is_observation: Mapped[bool] = mapped_column(Boolean, default=False)
    # El patrón tal como lo devolvió la IA (title, direction, cause, explanation, quotes, proposal, confidence).
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)
    # Foto de cada caso al analizar: llamada, tipo, IA, cliente y revisión manual.
    cases: Mapped[list[Any]] = mapped_column(default=list)
    reviewer_disagreements: Mapped[int] = mapped_column(Integer, default=0)


class ProposalDecision(Base):
    """Decisión del admin sobre la propuesta de un patrón (D-64). Vive aparte para sobrevivir a análisis nuevos."""

    __tablename__ = "proposal_decisions"

    pattern_id: Mapped[str] = mapped_column(ForeignKey("discrepancy_patterns.id"), primary_key=True)
    # pending | accepted | discarded | included | asked_client | calibrated
    status: Mapped[str] = mapped_column(String(20), default="pending")
    edited_text: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    included_in_version: Mapped[str | None] = mapped_column(String(20))
    decided_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime] = mapped_column(default=now)

    decided_by: Mapped[User] = relationship()


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
    # Motivos que el auditor del cliente marcó NO CUMPLE (C01..C33); None si el Excel no los trae. Solo admin (D-55).
    external_item_fails: Mapped[list[Any] | None] = mapped_column(JSON)
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


class DisagreementVerification(Base):
    """Verificación humana de un desacuerdo IA vs planilla (docs/ux/admin-prompt-metrics/04-verificacion-propuesta.md
    §10). Guarda la respuesta correcta del motivo, no "quién ganó": sirve para todas las versiones (H-15)."""

    __tablename__ = "disagreement_verifications"
    __table_args__ = (UniqueConstraint("case_id", "criterion_id"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True)
    criterion_id: Mapped[int] = mapped_column(Integer)
    outcome: Mapped[str] = mapped_column(String(20))  # ai_error | reviewer_error | ambiguous | missing_info
    correct: Mapped[str | None] = mapped_column(String(20))  # compliant | non_compliant | None
    reviewer_fail_at: Mapped[bool] = mapped_column(Boolean)  # la planilla al registrar (detecta reimportaciones)
    ai_verdict_at: Mapped[str] = mapped_column(String(20))
    version_at: Mapped[str] = mapped_column(String(20))
    seen_first: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text)
    decided_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime] = mapped_column(default=now)

    decided_by: Mapped[User] = relationship()


class VerificationAssignment(Base):
    """Llamada asignada a un verificador (docs/ux/admin-prompt-metrics/13-rol-verificador-asignacion.md). Una por
    llamada, sin versión: el registro de cada motivo sigue en DisagreementVerification. `reviewed_*` es la marca «Sin
    observaciones» de una llamada en que la IA y la planilla coinciden en todos los motivos."""

    __tablename__ = "verification_assignments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # Supervisores 2 con quienes se comparte la llamada (23 §7, AE22 A): calibran juntos, un registro por criterio.
    co_user_ids: Mapped[list[Any]] = mapped_column(default=list)
    assigned_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    assigned_at: Mapped[datetime] = mapped_column(default=now)
    reviewed_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column()

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    reviewed_by: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_id])


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


class PipelineRun(Base):
    """Una pasada del worker (Cambio 14, D-49/D-51): etapa en curso y contadores que se actualizan por audio."""

    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(default=now)
    finished_at: Mapped[datetime | None] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="running")  # running | done | failed | interrupted
    stage: Mapped[str | None] = mapped_column(String(20), default="listing")  # listing | transcribing | ...
    audios: Mapped[int] = mapped_column(Integer, default=0)
    waiting_metadata: Mapped[int] = mapped_column(Integer, default=0)
    batch_size: Mapped[int] = mapped_column(Integer, default=0)
    remaining: Mapped[int] = mapped_column(Integer, default=0)
    transcribe_total: Mapped[int] = mapped_column(Integer, default=0)
    transcribed: Mapped[int] = mapped_column(Integer, default=0)
    asr_errors: Mapped[int] = mapped_column(Integer, default=0)
    asr_rate_limited: Mapped[int] = mapped_column(Integer, default=0)
    validate_total: Mapped[int] = mapped_column(Integer, default=0)
    validated: Mapped[int] = mapped_column(Integer, default=0)
    archived: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)  # tipo de la excepción y mensaje corto, sin PII


class WorkerHeartbeat(Base):
    """Latido del worker (una sola fila, id = 1): si es viejo, la vista dice que el worker no responde (H-80)."""

    __tablename__ = "worker_heartbeat"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_seen_at: Mapped[datetime] = mapped_column(default=now)
    state: Mapped[str] = mapped_column(String(20), default="idle")  # idle | running
    next_run_at: Mapped[datetime | None] = mapped_column()
    loop_seconds: Mapped[int | None] = mapped_column(Integer)


class AsrFailure(Base):
    """Intentos fallidos de transcripción por grabación (antes work/asr_failures.json). Las de cuota no cuentan."""

    __tablename__ = "asr_failures"

    stem: Mapped[str] = mapped_column(String(255), primary_key=True)
    error: Mapped[str] = mapped_column(Text, default="")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_attempt_at: Mapped[datetime] = mapped_column(default=now)


class AnalysisSnapshot(Base):
    """Foto precomputada de «Calidad del servicio» (docs/ux/vistas-supervisor/08-alta-fidelidad.md §4.1). La arma
    `python -m call_audit.analysis.snapshot build`, sin IA; las vistas solo leen la vigente (`is_current`)."""

    __tablename__ = "analysis_snapshots"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(default=now)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    period_from: Mapped[str] = mapped_column(String(10))
    period_to: Mapped[str] = mapped_column(String(10))
    sheet_until: Mapped[str | None] = mapped_column(String(10))
    # {"perCall": "v2.10", "perCriterion": "v2.10"}: distintas → aviso S-07.
    runs: Mapped[dict[str, Any]] = mapped_column(default=dict)
    config: Mapped[dict[str, Any]] = mapped_column(default=dict)
    # Agregados de Motivos por combinación de filtros: {"criteria": {"<tipo>|<flujo>": [...]}, "filters": {...}}.
    payload: Mapped[dict[str, Any]] = mapped_column(default=dict)


class AnalysisSnapshotCall(Base):
    """Una llamada de la foto, con lo justo para filtrar y listar sin leer las corridas en vivo."""

    __tablename__ = "analysis_snapshot_calls"

    snapshot_id: Mapped[str] = mapped_column(ForeignKey("analysis_snapshots.id"), primary_key=True)
    case_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    call_id: Mapped[str] = mapped_column(String(64))
    call_date: Mapped[str] = mapped_column(String(10))
    agent_id: Mapped[str] = mapped_column(String(64))
    agent_name: Mapped[str] = mapped_column(String(200))
    evaluator: Mapped[str | None] = mapped_column(String(200))
    insurance_type: Mapped[str] = mapped_column(String(100))
    flow: Mapped[str] = mapped_column(String(100))
    ai_fails: Mapped[list[Any]] = mapped_column(default=list)
    sheet_fails: Mapped[list[Any] | None] = mapped_column(JSON)  # None: la planilla no la evaluó
    ai_evidence_ms: Mapped[dict[str, Any]] = mapped_column(default=dict)  # {"18": 61000}
    ai_verdict: Mapped[str] = mapped_column(String(20))
    sheet_verdict: Mapped[str | None] = mapped_column(String(20))
    # De dónde sale la referencia humana (D-31): auditor (revisión en la app) | sheet (planilla) | None.
    reference: Mapped[str | None] = mapped_column(String(10))


class AnalysisReport(Base):
    """Informe en Markdown publicado en «Calidad del servicio» (D-16, D-26). Lo carga el comando de la foto."""

    __tablename__ = "analysis_reports"

    slug: Mapped[str] = mapped_column(String(100), primary_key=True)
    snapshot_id: Mapped[str | None] = mapped_column(ForeignKey("analysis_snapshots.id"))
    title: Mapped[str] = mapped_column(String(300))
    date: Mapped[str] = mapped_column(String(10))
    run: Mapped[str] = mapped_column(String(100), default="")
    audience: Mapped[str] = mapped_column(String(10))  # company | internal
    body_md: Mapped[str] = mapped_column(Text)
    loaded_at: Mapped[datetime] = mapped_column(default=now)
