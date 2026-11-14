"""Embedded images and their `note-image:N` placeholders (content_constants.NOTE_IMAGE_SCHEME)."""

import re
from typing import Final

from app.constants.content_constants import NOTE_IMAGE_SCHEME
from app.content.document_values import attribute, children, node_type, objects
from app.content.text_rules import trim_ascii
from app.schemas.common.json_types import JsonObject, JsonValue

_EMBEDDED_PREFIX: Final = "data:"
_PLACEHOLDER: Final = re.compile(re.escape(NOTE_IMAGE_SCHEME) + r"([0-9]+)")


def embedded_images(doc: JsonObject | None) -> list[str]:
    """The data-URL source of every embedded image, in document order."""
    found: list[str] = []
    if doc is not None:
        _collect(doc, found)
    return found


def is_embedded(source: JsonValue) -> bool:
    return isinstance(source, str) and source.startswith(_EMBEDDED_PREFIX)


def placeholder(number: int) -> str:
    return f"{NOTE_IMAGE_SCHEME}{number}"


def placeholder_number(source: str) -> int | None:
    """The image number in `note-image:N`, or None when the source is not a placeholder."""
    match = _PLACEHOLDER.fullmatch(trim_ascii(source))
    return int(match.group(1)) if match else None


def _collect(node: JsonObject, found: list[str]) -> None:
    source = attribute(node, "src")
    if node_type(node) == "image" and isinstance(source, str) and is_embedded(source):
        found.append(source)
    for child in objects(children(node)):
        _collect(child, found)
