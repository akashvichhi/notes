"""The app factory. uvicorn runs it with --factory (scripts/start.sh); tests pass their own settings."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.health_router import health_router
from app.api.v1.api_router import api_router
from app.constants.http_constants import GZIP_MINIMUM_BYTES
from app.core.config import Settings
from app.core.database import create_database_engine, create_session_factory
from app.core.exception_handlers import register_exception_handlers
from app.core.frontend import Frontend
from app.core.logging_setup import configure_logging
from app.core.origin_check_middleware import OriginCheckMiddleware
from app.core.request_logging_middleware import RequestLoggingMiddleware

APP_TITLE = "Notes API"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings.log_level)
    engine = create_database_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        yield
        engine.dispose()

    # The API's schema is the contract in docs/, not a public interactive page.
    app = FastAPI(title=APP_TITLE, lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    app.state.frontend = Frontend(settings.web_dist_dir)

    register_exception_handlers(app)
    _add_middleware(app, settings)

    # API routes first: the web app only gets paths nothing else matched (the 404 handler).
    app.include_router(health_router)
    app.include_router(api_router)
    app.state.frontend.mount_assets(app)
    return app


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
