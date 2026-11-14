from typing import Self
from uuid import UUID

from pydantic import BaseModel

from app.models.user_model import User


class UserResource(BaseModel):
    uuid: UUID
    name: str
    email: str
    preferences: dict[str, str | bool]

    @classmethod
    def from_model(cls, user: User) -> Self:
        return cls(uuid=user.uuid, name=user.name, email=user.email, preferences=user.preferences)
