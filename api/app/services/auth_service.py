"""Sign-up, sign-in, sign-out and resolving a session cookie to its user."""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants import messages
from app.constants.auth_constants import (
    AUTH_ATTEMPTS_PER_IP,
    FAILED_LOGINS_PER_EMAIL,
    RATE_LIMIT_WINDOW_SECONDS,
    SESSION_REFRESH_INTERVAL_HOURS,
)
from app.core.clock import Clock
from app.core.exceptions import ConflictError, UnauthenticatedError
from app.core.rate_limiter import RateLimit, RateLimiter
from app.core.security import PasswordHasher, hash_token, new_session_token
from app.models.user_model import User
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.schemas.requests.auth_request import LoginRequest, RegisterRequest

AUTH_LIMIT_PER_IP = RateLimit(AUTH_ATTEMPTS_PER_IP, RATE_LIMIT_WINDOW_SECONDS)
FAILED_LOGIN_LIMIT_PER_EMAIL = RateLimit(FAILED_LOGINS_PER_EMAIL, RATE_LIMIT_WINDOW_SECONDS)
SESSION_REFRESH_INTERVAL = timedelta(hours=SESSION_REFRESH_INTERVAL_HOURS)


@dataclass(frozen=True)
class SignedIn:
    user: User
    session_token: str


@dataclass(frozen=True)
class Authenticated:
    user: User
    session_id: int
    # True when the expiry moved forward, so the cookie must be sent again.
    session_refreshed: bool


class AuthService:
    def __init__(
        self,
        db: Session,
        users: UserRepository,
        sessions: UserSessionRepository,
        hasher: PasswordHasher,
        limiter: RateLimiter,
        clock: Clock,
        session_lifetime: timedelta,
    ) -> None:
        self._db = db
        self._users = users
        self._sessions = sessions
        self._hasher = hasher
        self._limiter = limiter
        self._clock = clock
        self._session_lifetime = session_lifetime

    def register(self, request: RegisterRequest, client_address: str) -> SignedIn:
        self._limiter.hit(f"register:{client_address}", AUTH_LIMIT_PER_IP)
        if self._users.find_by_email(request.email) is not None:
            raise ConflictError.for_field("email", messages.EMAIL_TAKEN)
        try:
            user = self._users.add(
                User(
                    name=request.name, email=request.email, password_hash=self._hasher.hash(request.password)
                )
            )
        except IntegrityError:
            # Another sign-up with the same email won the race.
            self._db.rollback()
            raise ConflictError.for_field("email", messages.EMAIL_TAKEN) from None
        return self._sign_in(user)

    def login(self, request: LoginRequest, client_address: str) -> SignedIn:
        email_key = f"login-failures:{request.email}"
        self._limiter.hit(f"login:{client_address}", AUTH_LIMIT_PER_IP)
        self._limiter.check(email_key, FAILED_LOGIN_LIMIT_PER_EMAIL)
        user = self._users.find_by_email(request.email)
        if user is None or not self._hasher.verify(user.password_hash, request.password):
            if user is None:
                # Spend the same time as a wrong password, so timing never reveals the email.
                self._hasher.verify_nothing(request.password)
            self._limiter.hit(email_key, FAILED_LOGIN_LIMIT_PER_EMAIL)
            raise UnauthenticatedError(messages.INVALID_CREDENTIALS)
        self._limiter.clear(email_key)
        if self._hasher.needs_rehash(user.password_hash):
            user.password_hash = self._hasher.hash(request.password)
        return self._sign_in(user)

    def logout(self, session_token: str | None) -> None:
        if session_token is None:
            return
        self._sessions.delete_by_token_hash(hash_token(session_token))
        self._db.commit()

    def authenticate(self, session_token: str | None) -> Authenticated:
        if session_token is None:
            raise UnauthenticatedError
        user_session = self._sessions.find_by_token_hash(hash_token(session_token))
        if user_session is None:
            raise UnauthenticatedError
        now = self._clock.now()
        if user_session.expires_at <= now:
            self._sessions.delete(user_session)
            self._db.commit()
            raise UnauthenticatedError
        user = self._users.get(user_session.user_id)
        if user is None:
            raise UnauthenticatedError
        refreshed = user_session.expires_at - now < self._session_lifetime - SESSION_REFRESH_INTERVAL
        if refreshed:
            user_session.expires_at = now + self._session_lifetime
            self._db.commit()
        return Authenticated(user=user, session_id=user_session.id, session_refreshed=refreshed)

    def _sign_in(self, user: User) -> SignedIn:
        # A new random id on every sign-in, so an id seen before sign-in is worthless after.
        token = new_session_token()
        self._sessions.add(user.id, hash_token(token), self._clock.now() + self._session_lifetime)
        self._db.commit()
        return SignedIn(user=user, session_token=token)
