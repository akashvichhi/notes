"""Bearer-token authentication in front of the MCP server. A request reaches the server only
with a live personal access token that carries a notes ability, and within that token's
rate limit; the token is then in the request state for the tools."""

from collections.abc import Mapping

from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import Headers, State
from starlette.types import ASGIApp, Receive, Scope, Send

from app.constants.auth_constants import RATE_LIMIT_WINDOW_SECONDS
from app.constants.mcp_constants import BEARER_SCHEME, MCP_PRINCIPAL_STATE_KEY, MCP_REQUESTS_PER_MINUTE
from app.core.clock import Clock
from app.core.exception_handlers import error_json
from app.core.exceptions import DomainError, UnauthenticatedError
from app.core.rate_limiter import RateLimit, RateLimiter
from app.repositories.access_token_repository import AccessTokenRepository
from app.services.access_token_service import AccessTokenService, AuthenticatedToken

_RATE_LIMIT = RateLimit(MCP_REQUESTS_PER_MINUTE, RATE_LIMIT_WINDOW_SECONDS)
_RATE_LIMIT_BUCKET = "mcp"
_AUTHENTICATE_HEADER = "WWW-Authenticate"


class McpAuthentication:
    def __init__(self, app: ASGIApp, state: State) -> None:
        """`state` is the API's app state, read on every request: the session factory,
        clock and rate limiter it holds are the ones the rest of the API uses."""
        self._app = app
        self._state = state

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return
        try:
            token = await self._authenticate(Headers(scope=scope))
        except DomainError as error:
            response = error_json(error.to_response(), error.status_code, _headers_of(error))
            await response(scope, receive, send)
            return
        state = {**scope.get("state", {}), MCP_PRINCIPAL_STATE_KEY: token}
        await self._app({**scope, "state": state}, receive, send)

    async def _authenticate(self, headers: Headers) -> AuthenticatedToken:
        token_text = _bearer_token(headers)
        if token_text is None:
            raise UnauthenticatedError
        # In a worker thread: the database driver is synchronous.
        token = await run_in_threadpool(self._authenticate_token, token_text)
        limiter: RateLimiter = self._state.rate_limiter
        limiter.hit(f"{_RATE_LIMIT_BUCKET}:{token.token_id}", _RATE_LIMIT)
        return token

    def _authenticate_token(self, token_text: str) -> AuthenticatedToken:
        clock: Clock = self._state.clock
        session: Session
        with self._state.session_factory() as session:
            return AccessTokenService(session, AccessTokenRepository(session), clock).authenticate(token_text)


def _bearer_token(headers: Headers) -> str | None:
    scheme, _, credentials = headers.get("authorization", "").partition(" ")
    credentials = credentials.strip()
    if scheme.lower() != BEARER_SCHEME.lower() or not credentials:
        return None
    return credentials


def _headers_of(error: DomainError) -> Mapping[str, str]:
    """A 401 names the scheme the client should use, as HTTP asks of every 401."""
    if isinstance(error, UnauthenticatedError):
        return {**error.headers, _AUTHENTICATE_HEADER: BEARER_SCHEME}
    return error.headers
