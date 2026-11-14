from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.user_session_model import UserSession


class UserSessionRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, user_id: int, token_hash: str, expires_at: datetime) -> UserSession:
        user_session = UserSession(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        self._session.add(user_session)
        self._session.flush()
        return user_session

    def find_by_token_hash(self, token_hash: str) -> UserSession | None:
        return self._session.scalar(select(UserSession).where(UserSession.token_hash == token_hash))

    def delete_by_token_hash(self, token_hash: str) -> None:
        self._session.execute(delete(UserSession).where(UserSession.token_hash == token_hash))

    def delete(self, user_session: UserSession) -> None:
        self._session.delete(user_session)
        self._session.flush()

    def get(self, session_id: int) -> UserSession | None:
        return self._session.get(UserSession, session_id)

    def delete_others_of_user(self, user_id: int, keep_session_id: int) -> None:
        self._session.execute(
            delete(UserSession).where(UserSession.user_id == user_id, UserSession.id != keep_session_id)
        )
