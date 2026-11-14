from typing import Final

# Postgres text cannot hold it: input carrying one is refused, derived text drops it.
NUL_CHARACTER: Final = "\x00"

# Markdown larger than this is rejected before it is parsed; a body saved from it would
# exceed the body limit anyway (note_constants.NOTE_BODY_MAX_BYTES).
MARKDOWN_MAX_BYTES: Final = 1_000_000
# How deeply blocks may nest (quotes in lists in quotes ...) before the rest is plain text.
MARKDOWN_MAX_NESTING: Final = 100
# Pasted images live in the body as base64 data URLs, often megabytes each. Markdown handed
# to a client carries `note-image:N` placeholders instead; N counts the data-URL images in
# document order, starting at 1.
NOTE_IMAGE_SCHEME: Final = "note-image:"
