"""asignación de verificadores

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-13 18:00:00

docs/ux/admin-prompt-metrics/13-rol-verificador-asignacion.md: cada llamada se asigna a un verificador (rol
qubico_verifier). La marca «Sin observaciones» de las llamadas sin desacuerdos vive en la misma fila.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "verification_assignments",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("case_id", sa.String(32), sa.ForeignKey("cases.id"), nullable=False, unique=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_by_id", sa.String(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_by_id", sa.String(32), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_verification_assignments_user_id", "verification_assignments", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_verification_assignments_user_id", table_name="verification_assignments")
    op.drop_table("verification_assignments")
