"""/api/v1/me/access-tokens: personal access tokens for MCP clients."""

from fastapi import APIRouter, Depends, Response, status

from app.api.dependencies import (
    AccessTokenServiceDependency,
    CurrentUser,
    get_current_user,
    limit_access_token_creates,
)
from app.schemas.common.data_response import DataResponse
from app.schemas.requests.access_token_request import CreateAccessTokenRequest
from app.schemas.resources.access_token_resource import AccessTokenResource, CreatedAccessTokenResource

access_token_router = APIRouter(
    prefix="/me/access-tokens", tags=["access tokens"], dependencies=[Depends(get_current_user)]
)


@access_token_router.get("", response_model=DataResponse[list[AccessTokenResource]])
def list_access_tokens(
    user: CurrentUser, service: AccessTokenServiceDependency
) -> DataResponse[list[AccessTokenResource]]:
    return DataResponse(data=service.list(user))


@access_token_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=DataResponse[CreatedAccessTokenResource],
    dependencies=[Depends(limit_access_token_creates)],
)
def create_access_token(
    body: CreateAccessTokenRequest, user: CurrentUser, service: AccessTokenServiceDependency
) -> DataResponse[CreatedAccessTokenResource]:
    return DataResponse(data=service.create(user, body))


@access_token_router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_access_token(token_id: int, user: CurrentUser, service: AccessTokenServiceDependency) -> Response:
    service.revoke(user, token_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
