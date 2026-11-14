from alembic import command
from sqlalchemy import Engine, inspect

from tests.conftest import alembic_config

TABLES = {"users", "sessions", "access_tokens", "folders", "tags", "notes", "note_tag"}


def test_migrations_downgrade_to_nothing_and_upgrade_again(engine: Engine) -> None:
    # Postgres DDL is transactional, so the round trip is rolled back like any test.
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            config = alembic_config(connection)

            command.downgrade(config, "base")
            assert TABLES.isdisjoint(inspect(connection).get_table_names())

            command.upgrade(config, "head")
            assert set(inspect(connection).get_table_names()) >= TABLES
        finally:
            transaction.rollback()
