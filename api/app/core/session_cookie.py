"""The browser session cookie: HttpOnly, Secure (except local HTTP), SameSite=Lax, Path=/."""

from datetime import timedelta
from typing import Final

from fastapi import Request, Response

from app.core.config import Settings

COOKIE_PATH = "/"
COOKIE_SAME_SITE: Final = "lax"


class SessionCookie:
    def __init__(self, settings: Settings) -> None:
        self._name = settings.session_cookie_name
        self._secure = settings.session_cookie_secure
        self.lifetime = timedelta(days=settings.session_lifetime_days)

    def read(self, request: Request) -> str | None:
        return request.cookies.get(self._name) or None

    def write(self, response: Response, session_token: str) -> None:
        response.set_cookie(
            self._name,
            session_token,
            max_age=int(self.lifetime.total_seconds()),
            path=COOKIE_PATH,
            secure=self._secure,
            httponly=True,
            samesite=COOKIE_SAME_SITE,
        )

    def clear(self, response: Response) -> None:
        response.delete_cookie(
            self._name, path=COOKIE_PATH, secure=self._secure, httponly=True, samesite=COOKIE_SAME_SITE
        )
