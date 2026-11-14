"""One log line per request: method, route template, status and duration. Never the raw
path or query string: search terms and slugs are personal data. Uvicorn's own access
log is turned off for the same reason (scripts/start.sh)."""

import logging
import time
from http import HTTPStatus

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("app.requests")

UNMATCHED_ROUTE = "-"
MILLISECONDS_PER_SECOND = 1000


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        started = time.perf_counter()
        status_code = HTTPStatus.INTERNAL_SERVER_ERROR.value

        async def send_and_record_status(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self._app(scope, receive, send_and_record_status)
        finally:
            duration_ms = (time.perf_counter() - started) * MILLISECONDS_PER_SECOND
            route = getattr(scope.get("route"), "path", UNMATCHED_ROUTE)
            logger.info("%s %s %d %.1fms", scope["method"], route, status_code, duration_ms)
