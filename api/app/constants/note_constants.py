from enum import StrEnum

NOTE_TITLE_MAX_LENGTH = 255
NOTE_EXCERPT_COLUMN_LENGTH = 200
EMPTY_DOCUMENT_JSON = '{"type": "doc", "content": []}'


class NoteSort(StrEnum):
    """How note lists are ordered; also a saved preference."""

    UPDATED = "updated"
    CREATED = "created"
    TITLE = "title"
