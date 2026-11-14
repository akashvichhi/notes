from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.user_model import User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def any_exist(self) -> bool:
        return bool(self._session.scalar(select(exists().where(User.id.is_not(None)))))
