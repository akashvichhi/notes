from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_token
from app.models.access_token_model import AccessToken
from app.models.user_model import User
from app.models.user_session_model import UserSession
from app.repositories.access_token_repository import AccessTokenRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.services.expired_credentials_service import ExpiredCredentialsService, PrunedCredentials
from tests.factories import make_access_token
from tests.fakes import START_TIME, FakeClock

SECOND = timedelta(seconds=1)


def _service(db_session: Session, clock: FakeClock) -> ExpiredCredentialsService:
    return ExpiredCredentialsService(
        db_session, UserSessionRepository(db_session), AccessTokenRepository(db_session), clock
    )


def _add_session(db_session: Session, user: User, name: str, expires_in: timedelta) -> None:
    UserSessionRepository(db_session).add(user.id, hash_token(name), START_TIME + expires_in)


def test_prune_deletes_sessions_that_have_expired(db_session: Session, user: User, clock: FakeClock) -> None:
    _add_session(db_session, user, "expired", -SECOND)
    _add_session(db_session, user, "expiring now", timedelta(0))
    _add_session(db_session, user, "live", SECOND)

    pruned = _service(db_session, clock).prune()

    assert pruned.sessions == 2
    remaining = db_session.scalars(select(UserSession.token_hash)).all()
    assert remaining == [hash_token("live")]


def test_prune_deletes_tokens_that_have_expired_and_keeps_those_that_never_expire(
    db_session: Session, user: User, clock: FakeClock
) -> None:
    make_access_token(db_session, user, name="Expired", expires_at=START_TIME - SECOND)
    make_access_token(db_session, user, name="Expiring now", expires_at=START_TIME)
    make_access_token(db_session, user, name="Live", expires_at=START_TIME + SECOND)
    make_access_token(db_session, user, name="Forever")

    pruned = _service(db_session, clock).prune()

    assert pruned.access_tokens == 2
    remaining = db_session.scalars(select(AccessToken.name).order_by(AccessToken.name)).all()
    assert remaining == ["Forever", "Live"]


def test_prune_with_nothing_expired_removes_nothing(
    db_session: Session, user: User, clock: FakeClock
) -> None:
    _add_session(db_session, user, "live", SECOND)
    make_access_token(db_session, user)

    assert _service(db_session, clock).prune() == PrunedCredentials(sessions=0, access_tokens=0)
