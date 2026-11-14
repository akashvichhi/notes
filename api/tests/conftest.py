"""Tests run against a real Postgres (the ICU collation and full-text search need it).
The schema is rebuilt from the migrations once per run; every test then runs inside a
transaction that is rolled back, so tests never see each other's data."""

import os
from collections.abc import Callable, Iterator
from contextlib import ExitStack
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

from app.core.config import AppEnvironment, Settings
from app.core.database import create_database_engine, get_db_session
from app.main import create_app

DEFAULT_TEST_DATABASE_URL = "postgresql+psycopg://notes:secret@127.0.0.1:5432/notes_test"
ALLOWED_ORIGIN = "https://notes.test"
ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"

type AppFactory = Callable[[Settings], FastAPI]
type ClientFactory = Callable[[Settings], TestClient]


@pytest.fixture(scope="session")
def test_settings(tmp_path_factory: pytest.TempPathFactory) -> Settings:
    return Settings(
        _env_file=None,
        app_env=AppEnvironment.TEST,
        database_url=os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL),
        allowed_origins=[ALLOWED_ORIGIN],
        cors_origins=[],
        session_cookie_secure=True,
        # No build: tests that need the web app create their own (tests/integration/test_frontend.py).
        web_dist_dir=tmp_path_factory.mktemp("no_web_build"),
        allow_empty_database=True,
    )


def alembic_config(connection: object) -> Config:
    config = Config(str(ALEMBIC_INI))
    config.attributes["connection"] = connection
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture(scope="session")
def engine(test_settings: Settings) -> Iterator[Engine]:
    engine = create_database_engine(test_settings.database_url)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
        command.upgrade(alembic_config(connection), "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    with engine.connect() as connection:
        transaction = connection.begin()
        # Service commits only release a savepoint; the outer rollback undoes everything.
        session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()


@pytest.fixture
def build_app(db_session: Session) -> AppFactory:
    def build(settings: Settings) -> FastAPI:
        app = create_app(settings)
        app.dependency_overrides[get_db_session] = lambda: db_session
        return app

    return build


@pytest.fixture
def build_client(build_app: AppFactory) -> Iterator[ClientFactory]:
    with ExitStack() as stack:

        def build(settings: Settings) -> TestClient:
            return stack.enter_context(TestClient(build_app(settings), base_url="https://testserver"))

        yield build


@pytest.fixture
def client(build_client: ClientFactory, test_settings: Settings) -> TestClient:
    return build_client(test_settings)
