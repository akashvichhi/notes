from enum import StrEnum

NOTE_TITLE_MAX_LENGTH = 255
NOTE_EXCERPT_COLUMN_LENGTH = 200
EMPTY_DOCUMENT_JSON = '{"type": "doc", "content": []}'
# Derived from the body (content/note_text.py). The excerpt is measured in display width:
# a Chinese or Japanese character counts twice, so excerpts look the same length on screen.
NOTE_EXCERPT_WIDTH = 140
NOTE_DERIVED_TITLE_MAX_LENGTH = 120


class NoteSort(StrEnum):
    """How note lists are ordered; also a saved preference."""

    UPDATED = "updated"
    CREATED = "created"
    TITLE = "title"
