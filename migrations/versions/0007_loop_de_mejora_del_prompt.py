"""loop de mejora del prompt

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-11 12:00:00

docs/plan-loop-prompt.md: las pruebas pueden correr sobre entrenamiento (purpose "train") sin cambiar el estado de la
versión, el análisis de discrepancias puede leer una prueba en vez de la corrida vigente, y el loop guarda sus vueltas.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("prompt_evaluations", sa.Column("purpose", sa.String(20), nullable=True))
    op.add_column("prompt_evaluations", sa.Column("split", sa.String(10), nullable=True))
    op.add_column("prompt_evaluations", sa.Column("loop_id", sa.String(32), nullable=True))
    with op.batch_alter_table("discrepancy_analyses") as batch:
        batch.add_column(sa.Column("source_evaluation_id", sa.String(32), nullable=True))
        batch.add_column(sa.Column("purpose", sa.String(20), nullable=True))
        batch.create_foreign_key(
            "fk_discrepancy_analyses_source_evaluation", "prompt_evaluations", ["source_evaluation_id"], ["id"]
        )
    op.create_table(
        "prompt_loops",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("base_version", sa.String(20), nullable=False),
        sa.Column("max_rounds", sa.Integer(), nullable=False),
        sa.Column("analysis_model", sa.String(100), nullable=False),
        sa.Column("rounds", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.String(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("prompt_loops")
    with op.batch_alter_table("discrepancy_analyses") as batch:
        batch.drop_constraint("fk_discrepancy_analyses_source_evaluation", type_="foreignkey")
        batch.drop_column("purpose")
        batch.drop_column("source_evaluation_id")
    op.drop_column("prompt_evaluations", "loop_id")
    op.drop_column("prompt_evaluations", "split")
    op.drop_column("prompt_evaluations", "purpose")
