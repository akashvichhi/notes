"""The nightly script, end to end against the test database."""

import logging
from contextlib import nullcontext

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.folder_model import Folder
from app.models.note_model import Note
from app.models.user_model import User
from scripts.reset_demo import reset_demo

DEMO_EMAIL = "demo@example.com"


def _with_demo(settings: Settings, email: str) -> Settings:
    return settings.model_copy(
        update={"demo_email": email, "demo_password": "Demo@2026", "demo_name": "Demo"}
    )


def _user_count(db_session: Session) -> int:
    return db_session.scalar(select(func.count()).select_from(User)) or 0


def test_reset_is_off_without_a_demo_email(
    db_session: Session, test_settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    users_before = _user_count(db_session)

    with caplog.at_level(logging.INFO):
        result = reset_demo(_with_demo(test_settings, ""), lambda: nullcontext(db_session))

    assert result is None
    assert _user_count(db_session) == users_before
    assert "off" in caplog.text


def test_reset_demo_gives_the_configured_account_the_sample_content(
    db_session: Session, test_settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO):
        result = reset_demo(_with_demo(test_settings, DEMO_EMAIL), lambda: nullcontext(db_session))

    assert result is not None
    user = db_session.get(User, result.user_id)
    assert user is not None
    assert user.email == DEMO_EMAIL
    folders = db_session.scalars(select(Folder.name).where(Folder.user_id == user.id)).all()
    assert sorted(folders) == ["Ideas", "Personal", "Work"]
    assert result.notes == 7


def test_reset_demo_logs_counts_and_ids_but_no_personal_data(
    db_session: Session, test_settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO):
        result = reset_demo(_with_demo(test_settings, DEMO_EMAIL), lambda: nullcontext(db_session))

    assert result is not None
    assert str(result.user_id) in caplog.text
    titles = db_session.scalars(select(Note.title).where(Note.user_id == result.user_id)).all()
    for personal in (DEMO_EMAIL, "Demo@2026", *titles):
        assert personal not in caplog.text
