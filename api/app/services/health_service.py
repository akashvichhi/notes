from app.repositories.health_repository import HealthRepository
from app.schemas.resources.health_resource import HealthResource, HealthStatus


class HealthService:
    def __init__(self, repository: HealthRepository) -> None:
        self._repository = repository

    def check(self) -> HealthResource:
        self._repository.ping()
        return HealthResource(status=HealthStatus.OK)
