from typing import Self
from uuid import UUID

from pydantic import BaseModel

from app.models.folder_model import Folder


class McpFolderResource(BaseModel):
    id: UUID
    name: str
    # "Work / Projects".
    path: str
    color: str | None
    position: int

    @classmethod
    def from_model(cls, folder: Folder, path: str) -> Self:
        return cls(id=folder.uuid, name=folder.name, path=path, color=folder.color, position=folder.position)


class McpFolderNodeResource(BaseModel):
    """A folder in the tree, with the number of active notes directly in it."""

    id: UUID
    name: str
    color: str | None
    position: int
    note_count: int
    children: list[McpFolderNodeResource]


class McpFolderTreeResource(BaseModel):
    folders: list[McpFolderNodeResource]
    notes_outside_folders: int
    total_notes: int
