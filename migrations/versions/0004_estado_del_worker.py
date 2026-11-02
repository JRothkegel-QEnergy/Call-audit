"""estado del worker: pasadas, latido y fallas de transcripción

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-02 11:00:00

Cambio 14 de UX: la vista Procesamiento del admin lee el avance de cada pasada, el latido del worker y las fallas de
ASR, que antes quedaban solo en el log y en work/asr_failures.json.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COUNTERS = (
    "audios",
    "waiting_metadata",
    "batch_size",
    "remaining",
    "transcribe_total",
    "transcribed",
    "asr_errors",
    "asr_rate_limited",
    "validate_total",
    "validated",
    "archived",
)


def upgrade() -> None:
    op.create_table(
        "pipeline_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=True),
        *(sa.Column(name, sa.Integer(), nullable=False) for name in COUNTERS),
        sa.Column("error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "worker_heartbeat",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("loop_seconds", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "asr_failures",
        sa.Column("stem", sa.String(length=255), nullable=False),
        sa.Column("error", sa.Text(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("stem"),
    )


def downgrade() -> None:
    op.drop_table("asr_failures")
    op.drop_table("worker_heartbeat")
    op.drop_table("pipeline_runs")
