"""administrador qubico: invitaciones, registro de prompts, pruebas y actividad

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-23 11:00:00

Cambio 12 de UX: rol qubico_admin, invitaciones por correo, registro inmutable de versiones del prompt con su
prueba contra la referencia, y detalle en el registro de actividad.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("created_by_id", sa.String(length=32), nullable=True))
        batch.add_column(sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("invite_token_hash", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("invite_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("invite_kind", sa.String(length=10), nullable=True))
        batch.add_column(sa.Column("invite_used_at", sa.DateTime(timezone=True), nullable=True))
        batch.create_foreign_key("fk_users_created_by", "users", ["created_by_id"], ["id"])
        batch.create_index("ix_users_invite_token_hash", ["invite_token_hash"])

    with op.batch_alter_table("prompt_versions") as batch:
        # Las versiones que ya estaban las importó el bench: quedan retiradas hasta que el admin active una.
        batch.add_column(sa.Column("status", sa.String(length=20), nullable=False, server_default="retired"))
        batch.add_column(sa.Column("source", sa.String(length=10), nullable=False, server_default="bench"))
        batch.add_column(sa.Column("spec_yaml", sa.Text(), nullable=True))
        batch.add_column(sa.Column("schema_json", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("model", sa.String(length=100), nullable=False, server_default=""))
        batch.add_column(sa.Column("changelog", sa.Text(), nullable=False, server_default=""))
        batch.add_column(sa.Column("rationale", sa.Text(), nullable=True))
        batch.add_column(sa.Column("history", sa.JSON(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("created_by_id", sa.String(length=32), nullable=True))
        batch.add_column(sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("tested_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("activated_by_id", sa.String(length=32), nullable=True))
        batch.add_column(sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("activation_reason", sa.Text(), nullable=True))
        batch.add_column(sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True))
        batch.create_foreign_key("fk_prompt_versions_created_by", "users", ["created_by_id"], ["id"])
        batch.create_foreign_key("fk_prompt_versions_activated_by", "users", ["activated_by_id"], ["id"])

    with op.batch_alter_table("access_log") as batch:
        batch.add_column(sa.Column("details", sa.Text(), nullable=False, server_default=""))

    op.create_table(
        "prompt_evaluations",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("requested_by_id", sa.String(length=32), nullable=False),
        sa.Column("stopped_by_id", sa.String(length=32), nullable=True),
        sa.Column("case_ids", sa.JSON(), nullable=False),
        sa.Column("done", sa.Integer(), nullable=False),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=True),
        sa.Column("cost_usd", sa.Float(), nullable=False),
        sa.Column("results", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["version"], ["prompt_versions.version"]),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["stopped_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("prompt_evaluations")
    with op.batch_alter_table("access_log") as batch:
        batch.drop_column("details")
    with op.batch_alter_table("prompt_versions") as batch:
        batch.drop_constraint("fk_prompt_versions_activated_by", type_="foreignkey")
        batch.drop_constraint("fk_prompt_versions_created_by", type_="foreignkey")
        for column in (
            "retired_at",
            "activation_reason",
            "activated_at",
            "activated_by_id",
            "tested_at",
            "created_at",
            "created_by_id",
            "history",
            "rationale",
            "changelog",
            "model",
            "schema_json",
            "spec_yaml",
            "source",
            "status",
        ):
            batch.drop_column(column)
    with op.batch_alter_table("users") as batch:
        batch.drop_index("ix_users_invite_token_hash")
        batch.drop_constraint("fk_users_created_by", type_="foreignkey")
        for column in ("invite_used_at", "invite_kind", "invite_expires_at", "invite_token_hash", "last_login_at"):
            batch.drop_column(column)
        batch.drop_column("created_by_id")
