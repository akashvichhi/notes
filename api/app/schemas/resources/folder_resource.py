from typing import Self
from uuid import UUID

from pydantic import BaseModel

from app.models.folder_model import Folder


class FolderResource(BaseModel):
    uuid: UUID
    name: str
    parent_uuid: UUID | None
    color: str | None
    position: int

    @classmethod
    def from_model(cls, folder: Folder, parent_uuid: UUID | None) -> Self:
        return cls(
            uuid=folder.uuid,
            name=folder.name,
            parent_uuid=parent_uuid,
            color=folder.color,
            position=folder.position,
        )
