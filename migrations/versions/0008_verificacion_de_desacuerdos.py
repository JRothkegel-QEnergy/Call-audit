"""verificación de desacuerdos

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-12 18:00:00

docs/ux/admin-prompt-metrics/04-verificacion-propuesta.md §10: registro humano de quién tenía razón en cada desacuerdo
IA vs planilla (llamada × motivo). Guarda la respuesta correcta, así que vale para todas las versiones del prompt.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "disagreement_verifications",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("case_id", sa.String(32), sa.ForeignKey("cases.id"), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("correct", sa.String(20), nullable=True),
        sa.Column("reviewer_fail_at", sa.Boolean(), nullable=False),
        sa.Column("ai_verdict_at", sa.String(20), nullable=False),
        sa.Column("version_at", sa.String(20), nullable=False),
        sa.Column("seen_first", sa.Boolean(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("decided_by_id", sa.String(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("case_id", "criterion_id"),
    )
    op.create_index("ix_disagreement_verifications_case_id", "disagreement_verifications", ["case_id"])


def downgrade() -> None:
    op.drop_index("ix_disagreement_verifications_case_id", table_name="disagreement_verifications")
    op.drop_table("disagreement_verifications")
