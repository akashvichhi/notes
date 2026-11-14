from uuid import UUID

from pydantic import BaseModel

from app.schemas.resources.folder_resource import FolderResource
from app.schemas.resources.note_resource import NoteListItemResource
from app.schemas.resources.tag_resource import TagResource
from app.schemas.resources.user_resource import UserResource


class FolderCountResource(BaseModel):
    uuid: UUID
    count: int


class TagCountResource(BaseModel):
    slug: str
    count: int


class NoteCountsResource(BaseModel):
    """Active notes, except trashed. Every folder and tag is listed, with 0 when empty."""

    all: int
    starred: int
    trashed: int
    folders: list[FolderCountResource]
    tags: list[TagCountResource]


class BootstrapResource(BaseModel):
    """Everything the app needs to open, in one request."""

    user: UserResource
    folders: list[FolderResource]
    tags: list[TagResource]
    counts: NoteCountsResource
    notes: list[NoteListItemResource]
