from datetime import datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models.access_token_model import AccessToken


class AccessTokenRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def all_of_user(self, user_id: int) -> list[AccessToken]:
        return list(
            self._session.scalars(
                select(AccessToken)
                .where(AccessToken.user_id == user_id)
                .order_by(AccessToken.created_at.desc(), AccessToken.id.desc())
            )
        )

    def find_of_user(self, user_id: int, token_id: int) -> AccessToken | None:
        return self._session.scalar(
            select(AccessToken).where(AccessToken.user_id == user_id, AccessToken.id == token_id)
        )

    def count_active(self, user_id: int, now: datetime) -> int:
        """Tokens that never expire or have not expired yet."""
        query = (
            select(func.count())
            .select_from(AccessToken)
            .where(
                AccessToken.user_id == user_id,
                or_(AccessToken.expires_at.is_(None), AccessToken.expires_at > now),
            )
        )
        return self._session.scalar(query) or 0

    def add(self, token: AccessToken) -> AccessToken:
        self._session.add(token)
        self._session.flush()
        return token

    def delete(self, token: AccessToken) -> None:
        self._session.delete(token)
        self._session.flush()

    def delete_all_of_user(self, user_id: int) -> None:
        self._session.execute(delete(AccessToken).where(AccessToken.user_id == user_id))
