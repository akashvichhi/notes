from typing import Self
from uuid import UUID

from pydantic import BaseModel

from app.models.folder_model import Folder
from app.models.note_model import Note
from app.schemas.common.app_datetime import AppDateTime
from app.schemas.common.json_types import JsonObject


class NoteFolderResource(BaseModel):
    uuid: UUID
    name: str

    @classmethod
    def from_model(cls, folder: Folder | None) -> Self | None:
        return None if folder is None else cls(uuid=folder.uuid, name=folder.name)


class NoteListItemResource(BaseModel):
    """A note in a list: everything but the body."""

    uuid: UUID
    title: str
    excerpt: str
    is_starred: bool
    folder: NoteFolderResource | None
    # Tag slugs.
    tags: list[str]
    updated_at: AppDateTime
    deleted_at: AppDateTime | None

    @classmethod
    def from_model(cls, note: Note) -> Self:
        return cls(
            uuid=note.uuid,
            title=note.title,
            excerpt=note.excerpt,
            is_starred=note.is_starred,
            folder=NoteFolderResource.from_model(note.folder),
            tags=[tag.slug for tag in note.tags],
            updated_at=note.updated_at,
            deleted_at=note.deleted_at,
        )


class NoteResource(NoteListItemResource):
    body: JsonObject
    version: int
    word_count: int
    title_locked: bool

    @classmethod
    def from_model(cls, note: Note) -> Self:
        return cls(
            **NoteListItemResource.from_model(note).model_dump(),
            body=note.body,
            version=note.version,
            word_count=note.word_count,
            title_locked=note.title_locked,
        )
