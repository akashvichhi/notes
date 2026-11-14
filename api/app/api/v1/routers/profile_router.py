"""/api/v1/me: the signed-in user's own account. GET is /api/v1/auth/me."""

from fastapi import APIRouter, Depends, Response, status

from app.api.dependencies import (
    CurrentAuthentication,
    CurrentUser,
    ProfileServiceDependency,
    SessionCookieDependency,
    get_current_user,
)
from app.schemas.common.data_response import DataResponse
from app.schemas.requests.profile_request import (
    ChangePasswordRequest,
    UpdatePreferencesRequest,
    UpdateProfileRequest,
)
from app.schemas.resources.user_resource import UserResource

profile_router = APIRouter(prefix="/me", tags=["profile"], dependencies=[Depends(get_current_user)])


@profile_router.patch("", response_model=DataResponse[UserResource])
def update_profile(
    body: UpdateProfileRequest, user: CurrentUser, service: ProfileServiceDependency
) -> DataResponse[UserResource]:
    return DataResponse(data=UserResource.from_model(service.update_profile(user, body)))


@profile_router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    authentication: CurrentAuthentication,
    service: ProfileServiceDependency,
    cookie: SessionCookieDependency,
) -> Response:
    session_token = service.change_password(authentication.user, authentication.session_id, body)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    cookie.write(response, session_token)
    return response


@profile_router.patch("/preferences", response_model=DataResponse[UserResource])
def update_preferences(
    body: UpdatePreferencesRequest, user: CurrentUser, service: ProfileServiceDependency
) -> DataResponse[UserResource]:
    return DataResponse(data=UserResource.from_model(service.update_preferences(user, body)))
