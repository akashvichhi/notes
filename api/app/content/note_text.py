"""Text derived from a note body: what search, note lists and the automatic title read.
Recomputed on every write that changes the body; clients never send these values."""

from collections.abc import Iterator
from dataclasses import dataclass

from app.constants.note_constants import NOTE_DERIVED_TITLE_MAX_LENGTH, NOTE_EXCERPT_WIDTH
from app.content.text_rules import (
    WHITESPACE_RUNS,
    collapse_whitespace,
    display_width,
    rtrim_ascii,
    trim_ascii,
    truncate_to_width,
)
from app.schemas.common.json_types import JsonObject, JsonValue

_HEADING_TYPE = "heading"


@dataclass(frozen=True)
class NoteText:
    plain_text: str
    excerpt: str
    word_count: int
    # The automatic title; a note whose title the user set keeps that one.
    title: str


def derive_note_text(body: JsonObject) -> NoteText:
    plain_text = collapse_whitespace(" ".join(_texts(body)))
    return NoteText(
        plain_text=plain_text,
        excerpt=_excerpt(plain_text),
        word_count=0 if plain_text == "" else len(WHITESPACE_RUNS.split(plain_text)),
        title=_title(body),
    )


def _excerpt(plain_text: str) -> str:
    if display_width(plain_text) <= NOTE_EXCERPT_WIDTH:
        return plain_text
    return rtrim_ascii(truncate_to_width(plain_text, NOTE_EXCERPT_WIDTH))


def _title(body: JsonObject) -> str:
    """The first heading with text; without one, the first block with text. Unlike the
    plain text, the title keeps the spaces inside it as they are."""
    blocks = [block for block in _children(body) if isinstance(block, dict)]
    headings = [block for block in blocks if block.get("type") == _HEADING_TYPE]
    for block in (*headings, *blocks):
        text = trim_ascii(" ".join(_texts(block)))
        if text != "":
            return text[:NOTE_DERIVED_TITLE_MAX_LENGTH]
    return ""


def _texts(node: JsonObject) -> Iterator[str]:
    text = node.get("text")
    if isinstance(text, str):
        yield text
    for child in _children(node):
        if isinstance(child, dict):
            yield from _texts(child)


def _children(node: JsonObject) -> list[JsonValue]:
    content = node.get("content")
    return content if isinstance(content, list) else []
