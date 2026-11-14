from uuid import UUID

from pydantic import BaseModel

from app.schemas.common.field_types import TagName


class CreateTagRequest(BaseModel):
    """The client may choose the uuid, so a create retried after a lost response is safe."""

    uuid: UUID | None = None
    name: TagName


class RenameTagRequest(BaseModel):
    name: TagName
