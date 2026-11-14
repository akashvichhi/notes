import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.core.config import Settings
from app.core.startup_checks import EmptyDatabaseError
from app.main import create_app


def test_app_refuses_to_start_on_a_database_without_users(engine: Engine, test_settings: Settings) -> None:
    # The test database never has committed users; only rolled-back test transactions.
    app = create_app(test_settings.model_copy(update={"allow_empty_database": False}))

    with pytest.raises(EmptyDatabaseError), TestClient(app):
        pass


def test_app_starts_on_an_empty_database_when_allowed(engine: Engine, test_settings: Settings) -> None:
    with TestClient(create_app(test_settings)) as client:
        assert client.get("/api/health").status_code == 200
