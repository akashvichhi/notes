"""Argument types and hints shared by the tools. Text arguments reuse the request schemas'
field types, so they are trimmed and limited exactly as the web app's input is."""

from typing import Annotated
from uuid import UUID

from mcp.types import ToolAnnotations
from pydantic import Field

from app.constants.note_constants import NOTE_TAG_NAMES_MAX
from app.schemas.common.field_types import HexColor
from app.schemas.requests.note_request import TagNameInput

NoteUuid = Annotated[UUID, Field(description="The note uuid.")]
FolderId = Annotated[UUID, Field(description="The folder id from list_folders.")]
TagId = Annotated[UUID, Field(description="The tag id from list_tags.")]
TagNames = Annotated[list[TagNameInput], Field(max_length=NOTE_TAG_NAMES_MAX, description="Tag names.")]
FolderColor = Annotated[HexColor, Field(description="Colour as #rrggbb.")]

# Nothing here reaches outside the user's notes, and no tool deletes anything.
READS = ToolAnnotations(read_only_hint=True, destructive_hint=False, open_world_hint=False)
WRITES = ToolAnnotations(
    read_only_hint=False, destructive_hint=False, idempotent_hint=False, open_world_hint=False
)
# Repeating the call leaves the notes as the first call did.
SETS = ToolAnnotations(
    read_only_hint=False, destructive_hint=False, idempotent_hint=True, open_world_hint=False
)
