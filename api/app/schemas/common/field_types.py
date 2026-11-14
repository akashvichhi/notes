"""Reusable input types for request schemas: they trim, normalise and validate, and their
errors carry a type that core/exception_handlers.py turns into a readable message."""

from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, BeforeValidator, StringConstraints
from pydantic_core import PydanticCustomError

from app.constants.user_constants import PASSWORD_MIN_LENGTH, USER_EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH

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


Email = Annotated[str, BeforeValidator(normalise_email), StringConstraints(max_length=USER_EMAIL_MAX_LENGTH)]
UserName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=USER_NAME_MAX_LENGTH),
    AfterValidator(require_text),
]
# Passwords are never trimmed: a space is a valid character.
NewPassword = Annotated[str, StringConstraints(min_length=PASSWORD_MIN_LENGTH)]
GivenPassword = Annotated[str, AfterValidator(require_text)]
