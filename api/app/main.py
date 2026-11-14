"""The app factory. uvicorn runs it with --factory (scripts/start.sh); tests pass their own settings."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session, sessionmaker
from starlette.concurrency import run_in_threadpool

from app.api.health_router import health_router
from app.api.v1.api_router import api_router
from app.constants.http_constants import GZIP_MINIMUM_BYTES
from app.core.clock import Clock, SystemClock
from app.core.config import Settings
from app.core.database import create_database_engine, create_session_factory
from app.core.exception_handlers import register_exception_handlers
from app.core.frontend import Frontend
from app.core.logging_setup import configure_logging
from app.core.origin_check_middleware import OriginCheckMiddleware
from app.core.rate_limiter import RateLimiter
from app.core.request_logging_middleware import RequestLoggingMiddleware
from app.core.security import PasswordHasher
from app.core.session_cookie import SessionCookie
from app.core.startup_checks import ensure_database_has_users
from app.repositories.user_repository import UserRepository

APP_TITLE = "Notes API"


def create_app(settings: Settings | None = None, clock: Clock | None = None) -> FastAPI:
    settings = settings or Settings()
    clock = clock or SystemClock()
    configure_logging(settings.log_level)
    engine = create_database_engine(settings.database_url)
    session_factory = create_session_factory(engine)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        # In a worker thread: the database driver is synchronous.
        await run_in_threadpool(check_database, session_factory, settings)
        yield
        engine.dispose()

    # The API's schema is the contract in docs/, not a public interactive page.
    app = FastAPI(title=APP_TITLE, lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.frontend = Frontend(settings.web_dist_dir)
    app.state.clock = clock
    app.state.rate_limiter = RateLimiter(clock)
    app.state.password_hasher = PasswordHasher()
    app.state.session_cookie = SessionCookie(settings)

    register_exception_handlers(app)
    _add_middleware(app, settings)

    # API routes first: the web app only gets paths nothing else matched (the 404 handler).
    app.include_router(health_router)
    app.include_router(api_router)
    app.state.frontend.mount_assets(app)
    return app


def check_database(session_factory: sessionmaker[Session], settings: Settings) -> None:
    with session_factory() as session:
        ensure_database_has_users(UserRepository(session), settings.allow_empty_database)


def _add_middleware(app: FastAPI, settings: Settings) -> None:
    # Each add_middleware wraps the previous ones, so the last one added runs first.
    app.add_middleware(GZipMiddleware, minimum_size=GZIP_MINIMUM_BYTES)
    app.add_middleware(OriginCheckMiddleware, allowed_origins=settings.allowed_origins)
    if not settings.is_production and settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    app.add_middleware(RequestLoggingMiddleware)
