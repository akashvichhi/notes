"""GET /api/health: outside /api/v1 and public, for Docker's health check and uptime checks."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_health_service
from app.constants.http_constants import API_PATH_PREFIX
from app.schemas.common.data_response import DataResponse
from app.schemas.resources.health_resource import HealthResource
from app.services.health_service import HealthService

health_router = APIRouter(prefix=API_PATH_PREFIX, tags=["health"])


@health_router.get("/health", response_model=DataResponse[HealthResource])
def get_health(
    service: Annotated[HealthService, Depends(get_health_service)],
) -> DataResponse[HealthResource]:
    return DataResponse(data=service.check())
