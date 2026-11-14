from typing import Self
from uuid import UUID

from pydantic import BaseModel

from app.models.folder_model import Folder
from app.schemas.resources.tag_resource import TagResource


class SearchNoteResource(BaseModel):
    """The snippet is plain text; the client highlights the terms in it."""

    uuid: UUID
    title: str
    snippet: str
    terms: list[str]


class SearchFolderResource(BaseModel):
    uuid: UUID
    name: str

    @classmethod
    def from_model(cls, folder: Folder) -> Self:
        return cls(uuid=folder.uuid, name=folder.name)


class SearchResultsResource(BaseModel):
    notes: list[SearchNoteResource]
    folders: list[SearchFolderResource]
    tags: list[TagResource]
