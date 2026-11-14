"""Notes as the MCP tools return them. Folders are named by uuid and by their full path,
so an assistant can tell two folders called "Projects" apart."""

from typing import Self
from uuid import UUID

from pydantic import BaseModel

from app.models.note_model import Note
from app.schemas.common.app_datetime import AppDateTime


class McpNoteFields(BaseModel):
    """What every note shape has."""

    uuid: UUID
    title: str
    folder_id: UUID | None
    # "Work / Projects", or null outside any folder.
    folder: str | None
    # Tag names.
    tags: list[str]
    starred: bool
    updated_at: AppDateTime

    @classmethod
    def fields_of(cls, note: Note, folder_path: str | None) -> dict[str, object]:
        return {
            "uuid": note.uuid,
            "title": note.title,
            "folder_id": note.folder.uuid if note.folder is not None else None,
            "folder": folder_path,
            "tags": [tag.name for tag in note.tags],
            "starred": note.is_starred,
            "updated_at": note.updated_at,
        }


class McpNoteSummaryResource(McpNoteFields):
    excerpt: str

    @classmethod
    def from_model(cls, note: Note, folder_path: str | None, excerpt: str | None = None) -> Self:
        """`excerpt` replaces the note's own, e.g. with the text around a search match."""
        return cls.model_validate(
            {**cls.fields_of(note, folder_path), "excerpt": note.excerpt if excerpt is None else excerpt}
        )


class McpSavedNoteResource(McpNoteSummaryResource):
    """A note just written: the version is what the next update_note must pass."""

    version: int

    @classmethod
    def from_saved(cls, note: Note, folder_path: str | None) -> Self:
        return cls.model_validate(
            {**cls.fields_of(note, folder_path), "excerpt": note.excerpt, "version": note.version}
        )


class McpNoteResource(McpNoteFields):
    version: int
    created_at: AppDateTime
    word_count: int
    markdown: str

    @classmethod
    def from_model(cls, note: Note, folder_path: str | None, markdown: str) -> Self:
        return cls.model_validate(
            {
                **cls.fields_of(note, folder_path),
                "version": note.version,
                "created_at": note.created_at,
                "word_count": note.word_count,
                "markdown": markdown,
            }
        )


class McpNoteListResource(BaseModel):
    notes: list[McpNoteSummaryResource]
    page: int
    per_page: int
    total: int
    last_page: int


class McpSearchResultsResource(BaseModel):
    query: str
    count: int
    notes: list[McpNoteSummaryResource]
