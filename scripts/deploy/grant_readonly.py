"""Crea o actualiza el usuario de Postgres de solo lectura. Se puede correr de nuevo.

Corre dentro del contenedor de la API, con DATABASE_URL del entorno. readonly_access.sh le antepone RO_PASSWORD a este
archivo para que la clave no quede en la línea de comandos. Después de una migración que agrega tablas hay que volver a
correrlo: a propósito no hay permisos por defecto, para que una tabla nueva no quede expuesta sin que nadie lo decida.
"""

import os

import psycopg
from psycopg import sql

ROLE = "qubico_readonly"
STATEMENT_TIMEOUT = "60s"
# users va por columnas: sin password_hash ni los campos del enlace de invitación.
USERS_COLUMNS = (
    "id",
    "email",
    "name",
    "role",
    "permissions",
    "status",
    "created_at",
    "created_by_id",
    "last_login_at",
)


def main(password: str) -> None:
    url = os.environ["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://", 1)
    role = sql.Identifier(ROLE)
    with psycopg.connect(url) as conn:
        database = sql.Identifier(conn.info.dbname)
        exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (ROLE,)).fetchone()
        verb = sql.SQL("ALTER ROLE") if exists else sql.SQL("CREATE ROLE")
        conn.execute(
            sql.SQL("{} {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD {}").format(
                verb, role, sql.Literal(password)
            )
        )
        conn.execute(sql.SQL("ALTER ROLE {} SET default_transaction_read_only = on").format(role))
        conn.execute(sql.SQL("ALTER ROLE {} SET statement_timeout = {}").format(role, sql.Literal(STATEMENT_TIMEOUT)))
        conn.execute(sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {}").format(role))
        conn.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(database, role))
        conn.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(role))

        tables = [
            row[0]
            for row in conn.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'users' ORDER BY 1"
            )
        ]
        for table in tables:
            conn.execute(sql.SQL("GRANT SELECT ON {} TO {}").format(sql.Identifier(table), role))
        columns = sql.SQL(", ").join(sql.Identifier(c) for c in USERS_COLUMNS)
        conn.execute(sql.SQL("GRANT SELECT ({}) ON users TO {}").format(columns, role))
    print(f"Usuario {ROLE}: {len(tables)} tablas completas y users sin campos de credenciales.")


if __name__ == "__main__":
    main(RO_PASSWORD)  # type: ignore[name-defined]  # noqa: F821
