"""marca del cliente por motivo

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-02 18:00:00

Cambio 15 de UX: la pestaña "Calidad de la IA" compara cada corrida con los motivos que el auditor del cliente marcó
NO CUMPLE (C01..C33 del Excel). Se llena reimportando solo la metadata (python -m call_audit.ingestion.customer).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("cases", sa.Column("external_item_fails", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("cases", "external_item_fails")
