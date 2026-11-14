"""Wires repositories and services for Depends(). App-wide objects (settings, clock, rate
limiter, password hasher) are created once in main.create_app and read from app.state."""

from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy.orm import Session

from app.constants.auth_constants import RATE_LIMIT_WINDOW_SECONDS, UNKNOWN_CLIENT_ADDRESS
from app.constants.note_constants import NOTE_SAVES_PER_MINUTE
from app.core.clock import Clock
from app.core.database import get_db_session
from app.core.rate_limiter import RateLimit, RateLimiter
from app.core.security import PasswordHasher
from app.core.session_cookie import SessionCookie
from app.models.user_model import User
from app.repositories.access_token_repository import AccessTokenRepository
from app.repositories.folder_repository import FolderRepository
from app.repositories.health_repository import HealthRepository
from app.repositories.note_repository import NoteRepository
from app.repositories.tag_repository import TagRepository
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.services.auth_service import Authenticated, AuthService
from app.services.folder_service import FolderService
from app.services.health_service import HealthService
from app.services.note_service import NoteService
from app.services.profile_service import ProfileService
from app.services.tag_service import TagService
from app.services.user_session_service import UserSessionService

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


def get_user_session_service(
    session: DbSession, clock: ClockDependency, cookie: SessionCookieDependency
) -> UserSessionService:
    return UserSessionService(UserSessionRepository(session), clock, cookie.lifetime)


UserSessionServiceDependency = Annotated[UserSessionService, Depends(get_user_session_service)]


def get_auth_service(
    session: DbSession,
    session_tokens: UserSessionServiceDependency,
    hasher: PasswordHasherDependency,
    limiter: RateLimiterDependency,
    clock: ClockDependency,
) -> AuthService:
    return AuthService(
        session,
        UserRepository(session),
        UserSessionRepository(session),
        session_tokens,
        hasher,
        limiter,
        clock,
    )


AuthServiceDependency = Annotated[AuthService, Depends(get_auth_service)]


def get_authentication(
    request: Request, response: Response, service: AuthServiceDependency, cookie: SessionCookieDependency
) -> Authenticated:
    """The signed-in user and session, or 401. Sends the cookie again when the session slid forward."""
    session_token = cookie.read(request)
    authenticated = service.authenticate(session_token)
    if authenticated.session_refreshed and session_token is not None:
        cookie.write(response, session_token)
    return authenticated


CurrentAuthentication = Annotated[Authenticated, Depends(get_authentication)]


def get_current_user(authentication: CurrentAuthentication) -> User:
    return authentication.user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_profile_service(
    session: DbSession, session_tokens: UserSessionServiceDependency, hasher: PasswordHasherDependency
) -> ProfileService:
    return ProfileService(
        session,
        UserRepository(session),
        UserSessionRepository(session),
        AccessTokenRepository(session),
        session_tokens,
        hasher,
    )


ProfileServiceDependency = Annotated[ProfileService, Depends(get_profile_service)]


def get_folder_service(session: DbSession) -> FolderService:
    return FolderService(session, FolderRepository(session))


FolderServiceDependency = Annotated[FolderService, Depends(get_folder_service)]


def get_tag_service(session: DbSession) -> TagService:
    return TagService(session, TagRepository(session))


TagServiceDependency = Annotated[TagService, Depends(get_tag_service)]


def get_note_service(session: DbSession, tags: TagServiceDependency, clock: ClockDependency) -> NoteService:
    return NoteService(session, NoteRepository(session), FolderRepository(session), tags, clock)


NoteServiceDependency = Annotated[NoteService, Depends(get_note_service)]

NOTE_SAVE_LIMIT = RateLimit(NOTE_SAVES_PER_MINUTE, RATE_LIMIT_WINDOW_SECONDS)


def limit_note_saves(user: CurrentUser, limiter: RateLimiterDependency) -> None:
    """Counts a note save per user; autosave stays far below the limit."""
    limiter.hit(f"note-saves:{user.id}", NOTE_SAVE_LIMIT)
