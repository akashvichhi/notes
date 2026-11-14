"""Wires repositories and services for Depends()."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.repositories.health_repository import HealthRepository
from app.services.health_service import HealthService

DbSession = Annotated[Session, Depends(get_db_session)]


def get_health_service(session: DbSession) -> HealthService:
    return HealthService(HealthRepository(session))
