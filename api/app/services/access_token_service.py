"""Personal access tokens, which let an MCP client use the user's notes. They work only
at /mcp, so a token can never manage the account or other tokens."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.constants import messages
from app.constants.access_token_constants import (
    ACCESS_TOKEN_ID_SEPARATOR,
    ACTIVE_ACCESS_TOKENS_MAX,
    AccessTokenExpiryDays,
)
from app.core.clock import Clock
from app.core.exceptions import DomainValidationError, NotFoundError
from app.core.security import hash_token, new_access_token_secret
from app.models.access_token_model import AccessToken
from app.models.user_model import User
from app.repositories.access_token_repository import AccessTokenRepository
from app.schemas.requests.access_token_request import CreateAccessTokenRequest
from app.schemas.resources.access_token_resource import AccessTokenResource, CreatedAccessTokenResource


class AccessTokenService:
    def __init__(self, db: Session, tokens: AccessTokenRepository, clock: Clock) -> None:
        self._db = db
        self._tokens = tokens
        self._clock = clock

    def list(self, user: User) -> list[AccessTokenResource]:
        return [AccessTokenResource.from_model(token) for token in self._tokens.all_of_user(user.id)]

    def create(self, user: User, request: CreateAccessTokenRequest) -> CreatedAccessTokenResource:
        now = self._clock.now()
        if self._tokens.count_active(user.id, now) >= ACTIVE_ACCESS_TOKENS_MAX:
            raise DomainValidationError.for_field("name", messages.ACCESS_TOKEN_LIMIT_REACHED)
        secret = new_access_token_secret()
        token = AccessToken(
            user_id=user.id,
            name=request.name,
            token_hash=hash_token(secret),
            abilities=request.abilities,
            expires_at=_expiry(now, request.expires_in_days),
        )
        self._tokens.add(token)
        self._db.commit()
        return CreatedAccessTokenResource(
            token=f"{token.id}{ACCESS_TOKEN_ID_SEPARATOR}{secret}",
            access_token=AccessTokenResource.from_model(token),
        )

    def revoke(self, user: User, token_id: int) -> None:
        """Another user's token is a 404, never revoked."""
        token = self._tokens.find_of_user(user.id, token_id)
        if token is None:
            raise NotFoundError
        self._tokens.delete(token)
        self._db.commit()


def _expiry(now: datetime, days: AccessTokenExpiryDays | None) -> datetime | None:
    return None if days is None else now + timedelta(days=days)
