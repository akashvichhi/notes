"""Reusable input types for request schemas: they trim, normalise and validate, and their
errors carry a type that core/exception_handlers.py turns into a readable message."""

from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, BeforeValidator, Field, StringConstraints
from pydantic_core import PydanticCustomError

from app.constants import messages
from app.constants.content_constants import NUL_CHARACTER
from app.constants.folder_constants import (
    FOLDER_COLOR_PATTERN,
    FOLDER_NAME_MAX_LENGTH,
    FOLDER_POSITION_MAX,
    FOLDER_POSITION_MIN,
)
from app.constants.note_constants import NOTE_TITLE_MAX_LENGTH
from app.constants.search_constants import SEARCH_QUERY_MAX_LENGTH, SEARCH_TERM_MIN_LENGTH
from app.constants.tag_constants import TAG_NAME_MAX_LENGTH
from app.constants.user_constants import PASSWORD_MIN_LENGTH, USER_EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH
from app.content.slug import slugify

# Error context key that moves an error raised by a whole-model validator onto one field.
FIELD_CONTEXT_KEY = "field"


def field_error(field: str, message: str) -> PydanticCustomError:
    """An error from a model validator that belongs to one field (e.g. a confirmation)."""
    return PydanticCustomError("field_error", message, {FIELD_CONTEXT_KEY: field})


def reject_null(value: object) -> object:
    """For optional fields of a partial update: leaving one out is fine, sending null is not."""
    if value is None:
        raise PydanticCustomError("required", "required")
    return value


NotNull = BeforeValidator(reject_null)


def reject_nul_character(value: object) -> object:
    """Postgres text cannot hold NUL, so text carrying one is refused here rather than
    failing at the database."""
    if isinstance(value, str) and NUL_CHARACTER in value:
        raise PydanticCustomError("nul_character", "contains a NUL character")
    return value


# Every text input type carries it, as its last item: the outermost before validator runs
# first, on the raw input, so an email with a NUL is reported as that, not as an invalid
# address. Placed ahead of StringConstraints it would split them and check lengths before
# trimming.
NoNulCharacter = BeforeValidator(reject_nul_character)


def require_text(value: str) -> str:
    if value == "":
        raise PydanticCustomError("required", "required")
    return value


def normalise_email(value: object) -> object:
    if not isinstance(value, str):
        return value
    email = value.strip().lower()
    if email == "":
        raise PydanticCustomError("required", "required")
    try:
        validate_email(email, check_deliverability=False)
    except EmailNotValidError:
        raise PydanticCustomError("email", "invalid email") from None
    return email


Email = Annotated[
    str,
    BeforeValidator(normalise_email),
    StringConstraints(max_length=USER_EMAIL_MAX_LENGTH),
    NoNulCharacter,
]
UserName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=USER_NAME_MAX_LENGTH),
    AfterValidator(require_text),
    NoNulCharacter,
]
# Passwords are never trimmed: a space is a valid character.
NewPassword = Annotated[str, StringConstraints(min_length=PASSWORD_MIN_LENGTH), NoNulCharacter]
GivenPassword = Annotated[str, AfterValidator(require_text), NoNulCharacter]
FolderName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=FOLDER_NAME_MAX_LENGTH),
    AfterValidator(require_text),
    NoNulCharacter,
]
HexColor = Annotated[str, StringConstraints(strip_whitespace=True, pattern=FOLDER_COLOR_PATTERN)]
FolderPosition = Annotated[int, Field(ge=FOLDER_POSITION_MIN, le=FOLDER_POSITION_MAX)]


def require_slug(value: str) -> str:
    """A tag is found by its slug, and a name like "日本語" has none (content/slug.py)."""
    if slugify(value) == "":
        raise PydanticCustomError("tag_name_without_slug", messages.TAG_NAME_WITHOUT_SLUG)
    return value


TagName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=TAG_NAME_MAX_LENGTH),
    AfterValidator(require_text),
    AfterValidator(require_slug),
    NoNulCharacter,
]
NoteTitle = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=NOTE_TITLE_MAX_LENGTH),
    AfterValidator(require_text),
    NoNulCharacter,
]
# A tag name as typed when tagging a note; names without a slug are skipped, not refused.
TagNameInput = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=TAG_NAME_MAX_LENGTH), NoNulCharacter
]
# A tag filter on a note list: a tag's name or slug.
TagFilter = Annotated[str, StringConstraints(max_length=TAG_NAME_MAX_LENGTH), NoNulCharacter]
# Narrows a note list. Short words are allowed, unlike SearchQuery, because the web
# app's filter box sends whatever was typed; the service ignores words too short to match.
NoteListSearch = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=SEARCH_QUERY_MAX_LENGTH), NoNulCharacter
]
# Shorter than one term, a query could never match a note.
SearchQuery = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=SEARCH_TERM_MIN_LENGTH, max_length=SEARCH_QUERY_MAX_LENGTH
    ),
    NoNulCharacter,
]
