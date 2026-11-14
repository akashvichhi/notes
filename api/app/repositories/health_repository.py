from sqlalchemy import select
from sqlalchemy.orm import Session


class HealthRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def ping(self) -> None:
        """Raises when the database can't answer."""
        self._session.execute(select(1))
