from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.user_model import User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def any_exist(self) -> bool:
        return bool(self._session.scalar(select(exists().where(User.id.is_not(None)))))

    def find_by_email(self, email: str) -> User | None:
        # The column's collation ignores case and accents, so this matches "Asha@Example.com" too.
        return self._session.scalar(select(User).where(User.email == email))

    def get(self, user_id: int) -> User | None:
        return self._session.get(User, user_id)

    def add(self, user: User) -> User:
        self._session.add(user)
        self._session.flush()
        return user
