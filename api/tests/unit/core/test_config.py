import pytest
from pydantic import ValidationError

from app.core.config import AppEnvironment, Settings

DATABASE_URL = "postgresql+psycopg://user:pass@localhost/db"


def test_origins_are_read_comma_separated_without_trailing_slashes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://a.example/, https://b.example ,")

    settings = Settings(_env_file=None, database_url=DATABASE_URL)

    assert settings.allowed_origins == ["https://a.example", "https://b.example"]


def test_production_refuses_to_start_without_an_allowed_origin() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url=DATABASE_URL, app_env=AppEnvironment.PRODUCTION)


def test_production_with_an_allowed_origin_is_valid() -> None:
    settings = Settings(
        _env_file=None,
        database_url=DATABASE_URL,
        app_env=AppEnvironment.PRODUCTION,
        allowed_origins=["https://notes.example"],
    )

    assert settings.is_production


def test_session_cookie_is_secure_unless_turned_off() -> None:
    assert Settings(_env_file=None, database_url=DATABASE_URL).session_cookie_secure


def test_demo_reset_is_off_unless_a_demo_email_is_set() -> None:
    assert Settings(_env_file=None, database_url=DATABASE_URL).demo_email == ""


def test_a_demo_email_without_a_password_or_name_refuses_to_start() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url=DATABASE_URL, demo_email="demo@example.com", demo_name="Demo")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url=DATABASE_URL, demo_email="demo@example.com", demo_password="x")


def test_a_complete_demo_account_is_valid() -> None:
    settings = Settings(
        _env_file=None,
        database_url=DATABASE_URL,
        demo_email="demo@example.com",
        demo_password="Demo@2026",
        demo_name="Demo",
    )

    assert settings.demo_email == "demo@example.com"
