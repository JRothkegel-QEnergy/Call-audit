"""calidad del servicio

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-17 18:00:00

docs/ux/vistas-supervisor/08-alta-fidelidad.md §4.1: foto precomputada de las vistas del supervisor, sus llamadas
y los informes publicados.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "analysis_snapshots",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("period_from", sa.String(10), nullable=False),
        sa.Column("period_to", sa.String(10), nullable=False),
        sa.Column("sheet_until", sa.String(10), nullable=True),
        sa.Column("runs", sa.JSON(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_analysis_snapshots_is_current", "analysis_snapshots", ["is_current"])
    op.create_table(
        "analysis_snapshot_calls",
        sa.Column("snapshot_id", sa.String(32), sa.ForeignKey("analysis_snapshots.id"), primary_key=True),
        sa.Column("case_id", sa.String(32), primary_key=True),
        sa.Column("call_id", sa.String(64), nullable=False),
        sa.Column("call_date", sa.String(10), nullable=False),
        sa.Column("agent_id", sa.String(64), nullable=False),
        sa.Column("agent_name", sa.String(200), nullable=False),
        sa.Column("evaluator", sa.String(200), nullable=True),
        sa.Column("insurance_type", sa.String(100), nullable=False),
        sa.Column("flow", sa.String(100), nullable=False),
        sa.Column("ai_fails", sa.JSON(), nullable=False),
        sa.Column("sheet_fails", sa.JSON(), nullable=True),
        sa.Column("ai_evidence_ms", sa.JSON(), nullable=False),
        sa.Column("ai_verdict", sa.String(20), nullable=False),
        sa.Column("sheet_verdict", sa.String(20), nullable=True),
        sa.Column("reference", sa.String(10), nullable=True),
    )
    op.create_table(
        "analysis_reports",
        sa.Column("slug", sa.String(100), primary_key=True),
        sa.Column("snapshot_id", sa.String(32), sa.ForeignKey("analysis_snapshots.id"), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("date", sa.String(10), nullable=False),
        sa.Column("run", sa.String(100), nullable=False),
        sa.Column("audience", sa.String(10), nullable=False),
        sa.Column("body_md", sa.Text(), nullable=False),
        sa.Column("loaded_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("analysis_reports")
    op.drop_table("analysis_snapshot_calls")
    op.drop_index("ix_analysis_snapshots_is_current", table_name="analysis_snapshots")
    op.drop_table("analysis_snapshots")
