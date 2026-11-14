"""Wires repositories and services for Depends(). App-wide objects (settings, clock, rate
limiter, password hasher) are created once in main.create_app and read from app.state."""

from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy.orm import Session

from app.constants.auth_constants import UNKNOWN_CLIENT_ADDRESS
from app.core.clock import Clock
from app.core.database import get_db_session
from app.core.rate_limiter import RateLimiter
from app.core.security import PasswordHasher
from app.core.session_cookie import SessionCookie
from app.models.user_model import User
from app.repositories.health_repository import HealthRepository
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.services.auth_service import AuthService
from app.services.health_service import HealthService

DbSession = Annotated[Session, Depends(get_db_session)]


def get_clock(request: Request) -> Clock:
    clock: Clock = request.app.state.clock
    return clock


def get_rate_limiter(request: Request) -> RateLimiter:
    limiter: RateLimiter = request.app.state.rate_limiter
    return limiter


def get_password_hasher(request: Request) -> PasswordHasher:
    hasher: PasswordHasher = request.app.state.password_hasher
    return hasher


def get_session_cookie(request: Request) -> SessionCookie:
    cookie: SessionCookie = request.app.state.session_cookie
    return cookie


def get_client_address(request: Request) -> str:
    """The caller's IP. Behind Caddy, uvicorn's --proxy-headers puts the real one here."""
    return request.client.host if request.client else UNKNOWN_CLIENT_ADDRESS


ClockDependency = Annotated[Clock, Depends(get_clock)]
RateLimiterDependency = Annotated[RateLimiter, Depends(get_rate_limiter)]
PasswordHasherDependency = Annotated[PasswordHasher, Depends(get_password_hasher)]
SessionCookieDependency = Annotated[SessionCookie, Depends(get_session_cookie)]
ClientAddress = Annotated[str, Depends(get_client_address)]


def get_health_service(session: DbSession) -> HealthService:
    return HealthService(HealthRepository(session))


def get_auth_service(
    session: DbSession,
    hasher: PasswordHasherDependency,
    limiter: RateLimiterDependency,
    clock: ClockDependency,
    cookie: SessionCookieDependency,
) -> AuthService:
    return AuthService(
        session,
        UserRepository(session),
        UserSessionRepository(session),
        hasher,
        limiter,
        clock,
        cookie.lifetime,
    )


AuthServiceDependency = Annotated[AuthService, Depends(get_auth_service)]


def get_current_user(
    request: Request, response: Response, service: AuthServiceDependency, cookie: SessionCookieDependency
) -> User:
    """The signed-in user, or 401. Sends the cookie again when the session slid forward."""
    session_token = cookie.read(request)
    authenticated = service.authenticate(session_token)
    if authenticated.session_refreshed and session_token is not None:
        cookie.write(response, session_token)
    return authenticated.user


CurrentUser = Annotated[User, Depends(get_current_user)]
