"""Alembic runs online only. Tests hand in their own connection through
config.attributes["connection"]; otherwise the URL comes from app/core/config.py."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection

import app.models  # noqa: F401 - registers every model on Base.metadata
from app.core.config import Settings
from app.core.database import create_database_engine
from app.models.base_model import Base

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)


def run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection: Connection | None = config.attributes.get("connection")
    if connection is not None:
        run_migrations(connection)
        return
    engine = create_database_engine(Settings().database_url)
    with engine.connect() as new_connection:
        run_migrations(new_connection)
    engine.dispose()


run_migrations_online()
