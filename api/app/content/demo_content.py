"""The demo account's sample content (data/demo_content.toml). Each note's Markdown goes
through markdown_to_document, the converter the MCP tools use, so a sample note is
stored exactly like a note written in the editor."""

import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

from pydantic import ConfigDict, TypeAdapter

from app.content.markdown_to_document import markdown_to_document
from app.schemas.common.json_types import JsonObject

DEMO_CONTENT_PATH: Final = Path(__file__).parent / "data" / "demo_content.toml"


@dataclass(frozen=True)
class DemoNote:
    body: JsonObject
    # A name from DemoContent.folders, or None for a note outside any folder.
    folder: str | None
    tags: tuple[str, ...]
    starred: bool


@dataclass(frozen=True)
class DemoContent:
    folders: tuple[str, ...]
    # In the order the note list shows them.
    notes: tuple[DemoNote, ...]


@dataclass(frozen=True)
class _NoteSource:
    # A misspelt key in the file is an error, not a silently missing value.
    __pydantic_config__ = ConfigDict(extra="forbid")

    markdown: str
    folder: str | None = None
    tags: tuple[str, ...] = field(default_factory=tuple)
    starred: bool = False


@dataclass(frozen=True)
class _ContentSource:
    __pydantic_config__ = ConfigDict(extra="forbid")

    folders: tuple[str, ...]
    notes: tuple[_NoteSource, ...]


def load_demo_content() -> DemoContent:
    source = TypeAdapter(_ContentSource).validate_python(
        tomllib.loads(DEMO_CONTENT_PATH.read_text(encoding="utf-8"))
    )
    return DemoContent(
        folders=source.folders,
        notes=tuple(
            DemoNote(markdown_to_document(note.markdown), note.folder, note.tags, note.starred)
            for note in source.notes
        ),
    )
