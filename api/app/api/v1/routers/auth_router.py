"""/api/v1/auth: the public sign-up, sign-in and sign-out endpoints, and /me.
Every other v1 router requires a session at router level."""

from fastapi import APIRouter, Request, Response, status

from app.api.dependencies import AuthServiceDependency, ClientAddress, CurrentUser, SessionCookieDependency
from app.schemas.common.data_response import DataResponse
from app.schemas.requests.auth_request import LoginRequest, RegisterRequest
from app.schemas.resources.user_resource import UserResource

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/register", status_code=status.HTTP_201_CREATED, response_model=DataResponse[UserResource])
def register(
    body: RegisterRequest,
    response: Response,
    service: AuthServiceDependency,
    cookie: SessionCookieDependency,
    client_address: ClientAddress,
) -> DataResponse[UserResource]:
    signed_in = service.register(body, client_address)
    cookie.write(response, signed_in.session_token)
    return DataResponse(data=UserResource.from_model(signed_in.user))


@auth_router.post("/login", response_model=DataResponse[UserResource])
def login(
    body: LoginRequest,
    response: Response,
    service: AuthServiceDependency,
    cookie: SessionCookieDependency,
    client_address: ClientAddress,
) -> DataResponse[UserResource]:
    signed_in = service.login(body, client_address)
    cookie.write(response, signed_in.session_token)
    return DataResponse(data=UserResource.from_model(signed_in.user))


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, service: AuthServiceDependency, cookie: SessionCookieDependency) -> Response:
    service.logout(cookie.read(request))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    cookie.clear(response)
    return response


@auth_router.get("/me", response_model=DataResponse[UserResource])
def me(user: CurrentUser) -> DataResponse[UserResource]:
    return DataResponse(data=UserResource.from_model(user))
