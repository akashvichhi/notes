from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.access_token_model import AccessToken


class AccessTokenRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def delete_all_of_user(self, user_id: int) -> None:
        self._session.execute(delete(AccessToken).where(AccessToken.user_id == user_id))
