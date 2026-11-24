"""calibración compartida

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-24 12:00:00

docs/ux/admin-prompt-metrics/23-modulo-de-calibracion.md §7 (AE22 A): una llamada puede estar asignada a más de un
Supervisor 2. El dueño sigue en `user_id`; los demás, en `co_user_ids`.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "verification_assignments",
        sa.Column("co_user_ids", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("verification_assignments", "co_user_ids")
