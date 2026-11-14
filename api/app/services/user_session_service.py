"""Issuing session ids. Shared by sign-in and password change, so both follow the same rule:
a fresh random id, only its hash stored, a full lifetime ahead."""

from datetime import timedelta

from app.core.clock import Clock
from app.core.security import hash_token, new_session_token
from app.models.user_session_model import UserSession
from app.repositories.user_session_repository import UserSessionRepository


class UserSessionService:
    def __init__(self, sessions: UserSessionRepository, clock: Clock, lifetime: timedelta) -> None:
        self._sessions = sessions
        self._clock = clock
        self.lifetime = lifetime

    def start(self, user_id: int) -> str:
        token = new_session_token()
        self._sessions.add(user_id, hash_token(token), self._clock.now() + self.lifetime)
        return token

    def rotate(self, user_session: UserSession) -> str:
        """Gives an existing session a new id, so the old id stops working."""
        token = new_session_token()
        user_session.token_hash = hash_token(token)
        user_session.expires_at = self._clock.now() + self.lifetime
        return token
