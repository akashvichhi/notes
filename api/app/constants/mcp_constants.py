from enum import StrEnum
from typing import Final

MCP_PATH: Final = "/mcp"
MCP_SERVER_NAME: Final = "notes"
MCP_SERVER_VERSION: Final = "2.0.0"
# Per token. An assistant working through a task makes a few calls a second at most.
MCP_REQUESTS_PER_MINUTE: Final = 120
BEARER_SCHEME: Final = "Bearer"
# How a folder's place in the tree is written: "Work / Projects".
FOLDER_PATH_SEPARATOR: Final = " / "
# The SDK's request state key for the authenticated token, set before any tool runs.
MCP_PRINCIPAL_STATE_KEY: Final = "mcp_principal"
MCP_INSTRUCTIONS: Final = """Read and write the user's notes.

- Note bodies are markdown. Formatting markdown cannot express round-trips as inline
  HTML (<u>, <mark>, <sub>, <sup>, <span style="color:#hex">, <p align="center">,
  <details><summary>); keep those tags intact when editing.
- Images appear as placeholders like ![image 1](note-image:1). Leave them exactly as they
  are to keep the image; remove one to remove that image. Never invent new placeholders.
- Notes in the Trash are invisible.
- Nothing can be deleted: there is no tool to delete, trash or restore notes, folders or
  tags. If the user asks for that, tell them to do it in the Notes app.
- Always call get_note immediately before update_note and pass the version it returned.
  If update_note reports a version conflict, call get_note again and reapply the change.
  To add to a note without rewriting it, use update_note with mode append or prepend.
- Folders and tags are referred to by id (a uuid); use list_folders and list_tags to find
  them. Tags on notes are given by name, and missing tags are created."""


class NoteBodyMode(StrEnum):
    """How update_note applies its markdown to the body."""

    REPLACE = "replace"
    APPEND = "append"
    PREPEND = "prepend"
