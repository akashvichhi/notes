"""Markdown (GitHub's dialect plus the inline HTML that document_to_markdown writes) to the
editor's document: Markdown → HTML → HTML fix-ups → raw document → DocumentNormalizer.
Derived text (title, plain text) is not set here: note_text derives it."""

from typing import Final

from app.constants import messages
from app.constants.content_constants import MARKDOWN_MAX_BYTES
from app.content.content_error import ContentError
from app.content.document_normalizer import DocumentNormalizer
from app.content.html_cleanup import prepare_html
from app.content.html_to_document import html_to_document
from app.content.markdown_html import markdown_to_html
from app.content.note_images import embedded_images
from app.content.text_rules import trim_ascii
from app.schemas.common.json_types import JsonObject

_ENCODING: Final = "utf-8"


def markdown_to_document(markdown: str, current_doc: JsonObject | None = None) -> JsonObject:
    """`current_doc` is the body the Markdown was read from, so `note-image:N`
    placeholders resolve to its images.

    Raises ContentError for Markdown that is too large or names an image it cannot have."""
    if len(markdown.encode(_ENCODING)) > MARKDOWN_MAX_BYTES:
        raise ContentError(messages.NOTE_TOO_LARGE)
    markdown = markdown.replace("\r\n", "\n").replace("\r", "\n")
    if trim_ascii(markdown) == "":
        return _empty_document()
    html = prepare_html(markdown_to_html(markdown))
    raw = html_to_document(html) if html != "" else _empty_document()
    return DocumentNormalizer(embedded_images(current_doc)).normalize(raw)


def _empty_document() -> JsonObject:
    return {"type": "doc", "content": []}
