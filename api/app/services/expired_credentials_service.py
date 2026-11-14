"""Removes sessions and access tokens past their expiry. Both are already refused once
expired; this only clears the rows nobody can use again, so the tables stay small."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.clock import Clock
from app.repositories.access_token_repository import AccessTokenRepository
from app.repositories.user_session_repository import UserSessionRepository


@dataclass(frozen=True)
class PrunedCredentials:
    sessions: int
    access_tokens: int


class ExpiredCredentialsService:
    def __init__(
        self, db: Session, sessions: UserSessionRepository, tokens: AccessTokenRepository, clock: Clock
    ) -> None:
        self._db = db
        self._sessions = sessions
        self._tokens = tokens
        self._clock = clock

    def prune(self) -> PrunedCredentials:
        now = self._clock.now()
        pruned = PrunedCredentials(
            sessions=self._sessions.delete_expired(now), access_tokens=self._tokens.delete_expired(now)
        )
        self._db.commit()
        return pruned
