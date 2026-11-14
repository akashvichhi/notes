from typing import Self
from uuid import UUID

from pydantic import BaseModel

from app.models.tag_model import Tag
from app.schemas.resources.tag_resource import TagResource


class McpTagResource(BaseModel):
    id: UUID
    name: str
    slug: str

    @classmethod
    def from_resource(cls, tag: TagResource) -> Self:
        return cls(id=tag.uuid, name=tag.name, slug=tag.slug)


class McpTagCountResource(McpTagResource):
    """A tag with the number of active notes that carry it."""

    note_count: int

    @classmethod
    def from_model(cls, tag: Tag, note_count: int) -> Self:
        return cls(id=tag.uuid, name=tag.name, slug=tag.slug, note_count=note_count)


class McpTagListResource(BaseModel):
    tags: list[McpTagCountResource]
