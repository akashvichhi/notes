"""CSRF protection for the session cookie: SameSite=Lax plus this check, which rejects a
write to /api/* sent from a page on an origin that is not allowed. A request without an
Origin header (curl, server-to-server) carries no browser session risk and passes."""

from http import HTTPStatus

from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

from app.constants import messages
from app.constants.http_constants import API_PATH_PREFIX, UNSAFE_METHODS
from app.core.exception_handlers import error_json
from app.schemas.common.error_response import ErrorResponse


class OriginCheckMiddleware:
    def __init__(self, app: ASGIApp, allowed_origins: list[str]) -> None:
        self._app = app
        self._allowed_origins = frozenset(allowed_origins)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and self._is_foreign_write(scope):
            response = error_json(ErrorResponse(error=messages.FOREIGN_ORIGIN), HTTPStatus.FORBIDDEN)
            await response(scope, receive, send)
            return
        await self._app(scope, receive, send)

    def _is_foreign_write(self, scope: Scope) -> bool:
        path: str = scope["path"]
        if scope["method"] not in UNSAFE_METHODS or not path.startswith(API_PATH_PREFIX):
            return False
        origin = Headers(scope=scope).get("origin")
        return origin is not None and origin.rstrip("/") not in self._allowed_origins
