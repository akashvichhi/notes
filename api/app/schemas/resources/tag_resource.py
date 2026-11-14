from typing import Self
from uuid import UUID

from pydantic import BaseModel

from app.models.tag_model import Tag


class TagResource(BaseModel):
    uuid: UUID
    name: str
    slug: str

    @classmethod
    def from_model(cls, tag: Tag) -> Self:
        return cls(uuid=tag.uuid, name=tag.name, slug=tag.slug)
