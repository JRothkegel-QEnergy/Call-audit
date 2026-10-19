"""Migraciones de Alembic. La URL sale de DATABASE_URL (call_audit.config.Settings)."""

from logging.config import fileConfig

from alembic import context

from call_audit.config import get_settings
from call_audit.persistence.db import make_engine
from call_audit.persistence.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def url() -> str:
    return config.get_main_option("sqlalchemy.url") or get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(url=url(), target_metadata=target_metadata, literal_binds=True, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with make_engine(url()).connect() as connection:
        # render_as_batch: SQLite no soporta ALTER de columnas; batch las recrea.
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
