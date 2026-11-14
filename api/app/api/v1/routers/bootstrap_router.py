"""/api/v1/bootstrap: what the app loads when it opens."""

from fastapi import APIRouter, Depends

from app.api.dependencies import BootstrapServiceDependency, CurrentUser, get_current_user
from app.schemas.common.data_response import DataResponse
from app.schemas.resources.bootstrap_resource import BootstrapResource

bootstrap_router = APIRouter(
    prefix="/bootstrap", tags=["bootstrap"], dependencies=[Depends(get_current_user)]
)


@bootstrap_router.get("", response_model=DataResponse[BootstrapResource])
def bootstrap(user: CurrentUser, service: BootstrapServiceDependency) -> DataResponse[BootstrapResource]:
    return DataResponse(data=service.build(user))
