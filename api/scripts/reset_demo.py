"""Restores the public demo account to its sample content. Run nightly:
uv run python -m scripts.reset_demo"""

import logging
from collections.abc import Callable
from contextlib import AbstractContextManager

from sqlalchemy.orm import Session

from app.content.demo_content import load_demo_content
from app.core.config import Settings
from app.core.database import create_database_engine, create_session_factory
from app.core.logging_setup import configure_logging
from app.core.security import PasswordHasher
from app.repositories.access_token_repository import AccessTokenRepository
from app.repositories.folder_repository import FolderRepository
from app.repositories.note_repository import NoteRepository
from app.repositories.tag_repository import TagRepository
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.services.demo_reset_service import DemoAccount, DemoResetResult, DemoResetService
from app.services.tag_service import TagService

logger = logging.getLogger(__name__)

type SessionFactory = Callable[[], AbstractContextManager[Session]]


def reset_demo(settings: Settings, session_factory: SessionFactory) -> DemoResetResult | None:
    """None when the reset is off (DEMO_EMAIL empty). Logs ids and counts only: the
    account's email and the notes are personal data."""
    if not settings.demo_email:
        logger.info("Demo reset is off: DEMO_EMAIL is empty")
        return None
    account = DemoAccount(email=settings.demo_email, password=settings.demo_password, name=settings.demo_name)
    content = load_demo_content()
    with session_factory() as session:
        tags = TagRepository(session)
        result = DemoResetService(
            session,
            UserRepository(session),
            UserSessionRepository(session),
            AccessTokenRepository(session),
            NoteRepository(session),
            FolderRepository(session),
            tags,
            TagService(session, tags),
            PasswordHasher(),
            content,
        ).reset(account)
    logger.info(
        "Reset demo user %d (created: %s): %d folders, %d tags, %d notes",
        result.user_id,
        result.created,
        result.folders,
        result.tags,
        result.notes,
    )
    return result


def main() -> None:
    settings = Settings()
    configure_logging(settings.log_level)
    engine = create_database_engine(settings.database_url)
    try:
        reset_demo(settings, create_session_factory(engine))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
