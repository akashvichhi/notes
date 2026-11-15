import json
from collections.abc import Mapping
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, Field, StrictBool, model_validator
from pydantic_core import PydanticCustomError

from app.constants import messages
from app.constants.note_constants import (
    NOTE_BODY_MAX_BYTES,
    NOTE_BODY_MAX_DEPTH,
    NOTE_TAG_NAMES_MAX,
    NoteSort,
)
from app.schemas.common.field_types import (
    NoteListSearch,
    NoteTitle,
    NotNull,
    TagFilter,
    TagNameInput,
    field_error,
)
from app.schemas.common.json_types import JsonObject
from app.schemas.common.pagination_request import PaginationRequest

_CONTENT_KEY = "content"


def body_depth(node: object, level: int = 0) -> int:
    """How deep the content tree goes; stops counting once past the limit."""
    if level > NOTE_BODY_MAX_DEPTH or not isinstance(node, dict):
        return level
    deepest = level
    children = node.get(_CONTENT_KEY)
    for child in children if isinstance(children, list) else []:
        deepest = max(deepest, body_depth(child, level + 1))
        if deepest > NOTE_BODY_MAX_DEPTH:
            return deepest
    return deepest


def body_limit_error(body: Mapping[str, object]) -> tuple[str, str] | None:
    """The error type and message when a body is too large or too deeply nested to save."""
    if len(json.dumps(body, separators=(",", ":")).encode()) > NOTE_BODY_MAX_BYTES:
        return "note_too_large", messages.NOTE_TOO_LARGE
    if body_depth(body) > NOTE_BODY_MAX_DEPTH:
        return "note_too_deep", messages.NOTE_TOO_DEEP
    return None


def _check_body_limits(value: object) -> object:
    """Runs before the body is validated as JSON, so a huge or deep body fails fast."""
    if not isinstance(value, dict):
        return value
    error = body_limit_error(value)
    if error is not None:
        raise PydanticCustomError(*error)
    return value


NoteBody = Annotated[JsonObject, BeforeValidator(_check_body_limits)]


class NoteListRequest(PaginationRequest):
    folder_id: UUID | None = None
    tag: TagFilter | None = None
    starred: bool = False
    trashed: bool = False
    # Only notes with a word starting with each term, as in the search endpoint.
    q: NoteListSearch | None = None
    sort: NoteSort = NoteSort.UPDATED


class CreateNoteRequest(BaseModel):
    """The client may choose the uuid, so a create retried after a lost response is safe."""

    uuid: UUID | None = None
    folder_id: UUID | None = None


class UpdateNoteRequest(BaseModel):
    """A body save carries the version it edited; metadata changes carry none, so they
    never clash with an autosave."""

    body: Annotated[NoteBody | None, NotNull] = None
    version: Annotated[Annotated[int, Field(ge=1)] | None, NotNull] = None
    title: Annotated[NoteTitle | None, NotNull] = None
    # null moves the note to the top level.
    folder_id: UUID | None = None
    is_starred: Annotated[StrictBool | None, NotNull] = None

    @model_validator(mode="after")
    def _version_comes_with_the_body(self) -> Self:
        if self.body is not None and self.version is None:
            raise field_error("version", messages.VERSION_REQUIRED_WITH_BODY)
        return self


class WriteNoteRequest(BaseModel):
    """A note written in one go, as an assistant does: the title is the user's choice, so it
    stays when the body changes."""

    title: NoteTitle
    body: NoteBody | None = None
    folder_id: UUID | None = None
    tag_names: Annotated[list[TagNameInput], Field(max_length=NOTE_TAG_NAMES_MAX)] = []


class SetNoteTagsRequest(BaseModel):
    """The whole set. Names that are new become tags; names without a slug are skipped."""

    names: Annotated[list[TagNameInput], Field(max_length=NOTE_TAG_NAMES_MAX)]


class RestoreNoteRequest(BaseModel):
    folder_id: UUID | None = None
