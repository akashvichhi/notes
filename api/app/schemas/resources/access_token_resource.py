from typing import Self

from pydantic import BaseModel

from app.models.access_token_model import AccessToken
from app.schemas.common.app_datetime import AppDateTime


class AccessTokenResource(BaseModel):
    """Never the token itself: it is shown once, when created."""

    id: int
    name: str
    abilities: list[str]
    created_at: AppDateTime
    last_used_at: AppDateTime | None
    expires_at: AppDateTime | None

    @classmethod
    def from_model(cls, token: AccessToken) -> Self:
        return cls(
            id=token.id,
            name=token.name,
            abilities=token.abilities,
            created_at=token.created_at,
            last_used_at=token.last_used_at,
            expires_at=token.expires_at,
        )


class CreatedAccessTokenResource(BaseModel):
    token: str
    access_token: AccessTokenResource
