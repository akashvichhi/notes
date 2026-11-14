"""Deletes expired sessions and access tokens. Run daily: uv run python -m scripts.prune_expired"""

import logging

from app.core.clock import SystemClock
from app.core.config import Settings
from app.core.database import create_database_engine, create_session_factory
from app.core.logging_setup import configure_logging
from app.repositories.access_token_repository import AccessTokenRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.services.expired_credentials_service import ExpiredCredentialsService

logger = logging.getLogger(__name__)


def main() -> None:
    settings = Settings()
    configure_logging(settings.log_level)
    engine = create_database_engine(settings.database_url)
    try:
        with create_session_factory(engine)() as session:
            service = ExpiredCredentialsService(
                session, UserSessionRepository(session), AccessTokenRepository(session), SystemClock()
            )
            pruned = service.prune()
    finally:
        engine.dispose()
    logger.info("Pruned %d sessions and %d access tokens", pruned.sessions, pruned.access_tokens)


if __name__ == "__main__":
    main()
