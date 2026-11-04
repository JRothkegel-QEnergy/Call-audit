"""análisis de discrepancias

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-04 18:00:00

Cambio 16 de UX: la IA de análisis de discrepancias corre en el worker cuando el admin la lanza. Cada corrida guarda
sus patrones por motivo; las decisiones sobre las propuestas viven aparte para no perderse con análisis nuevos.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "discrepancy_analyses",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("analysis_prompt_version", sa.String(20), nullable=False),
        sa.Column("layer2_series", sa.JSON(), nullable=False),
        sa.Column("criteria", sa.JSON(), nullable=False),
        sa.Column("done_criteria", sa.JSON(), nullable=False),
        sa.Column("failed_criteria", sa.JSON(), nullable=False),
        sa.Column("summaries", sa.JSON(), nullable=False),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=True),
        sa.Column("cost_usd", sa.Float(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.String(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("stopped_by_id", sa.String(32), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "discrepancy_patterns",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("analysis_id", sa.String(32), sa.ForeignKey("discrepancy_analyses.id"), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("impact", sa.Float(), nullable=False),
        sa.Column("is_observation", sa.Boolean(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("cases", sa.JSON(), nullable=False),
        sa.Column("reviewer_disagreements", sa.Integer(), nullable=False),
    )
    op.create_index("ix_discrepancy_patterns_analysis_id", "discrepancy_patterns", ["analysis_id"])
    op.create_table(
        "proposal_decisions",
        sa.Column("pattern_id", sa.String(32), sa.ForeignKey("discrepancy_patterns.id"), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("edited_text", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("included_in_version", sa.String(20), nullable=True),
        sa.Column("decided_by_id", sa.String(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("proposal_decisions")
    op.drop_index("ix_discrepancy_patterns_analysis_id", table_name="discrepancy_patterns")
    op.drop_table("discrepancy_patterns")
    op.drop_table("discrepancy_analyses")
