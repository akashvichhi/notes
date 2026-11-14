"""Every user-facing message. Messages never contain personal data."""

from app.constants.access_token_constants import ACTIVE_ACCESS_TOKENS_MAX

VALIDATION_FAILED = "Validation failed."
NOT_FOUND = "Not found."
METHOD_NOT_ALLOWED = "Method not allowed."
UNAUTHENTICATED = "Unauthenticated."
FORBIDDEN = "You are not allowed to do that."
FOREIGN_ORIGIN = "This request came from a site that is not allowed to change your notes."
TOO_MANY_REQUESTS = "Too many attempts. Please wait a minute and try again."
SERVER_ERROR = "Something went wrong. Please try again."
CONFLICT = "This conflicts with something that already exists."

# Pydantic prefixes messages raised from our own validators; the user only needs the message.
PYDANTIC_VALUE_ERROR_PREFIX = "Value error, "

INVALID_CREDENTIALS = "Incorrect email or password."
EMAIL_TAKEN = "An account with this email already exists."
PASSWORD_CONFIRMATION_MISMATCH = "The passwords do not match."  # noqa: S105 - a message

# Validation messages by Pydantic error type. {label} is the field's name in words, with a
# capital first letter ("per_page" -> "Per page"); the other placeholders come from the
# error's context.
VALIDATION_MESSAGE_TEMPLATES: dict[str, str] = {
    "missing": "{label} is required.",
    "required": "{label} is required.",
    "string_too_short": "{label} must be at least {min_length} characters.",
    "string_too_long": "{label} must be at most {max_length} characters.",
    "string_type": "{label} must be text.",
    "email": "Enter a valid email address.",
    "int_type": "{label} must be a whole number.",
    "int_parsing": "{label} must be a whole number.",
    "bool_type": "{label} must be true or false.",
    "bool_parsing": "{label} must be true or false.",
    "uuid_type": "{label} must be a valid UUID.",
    "uuid_parsing": "{label} must be a valid UUID.",
    "greater_than_equal": "{label} must be at least {ge}.",
    "less_than_equal": "{label} must be at most {le}.",
    "enum": "{label} is not one of the allowed values.",
    "literal_error": "{label} is not one of the allowed values.",
    "dict_type": "{label} must be an object.",
    "list_type": "{label} must be a list.",
    "too_long": "{label} can have at most {max_length} items.",
    "too_short": "{label} must have at least {min_length} item(s).",
    "json_invalid": "The request body is not valid JSON.",
    "model_attributes_type": "The request body must be a JSON object.",
    "string_pattern_mismatch": "{label} has an invalid format.",
    "nul_character": "{label} must not contain a NUL character.",
}

CURRENT_PASSWORD_INCORRECT = "The current password is incorrect."  # noqa: S105 - a message
NAME_TAKEN = "This name is already in use."
TAG_NAME_WITHOUT_SLUG = "Name must include a letter or digit that can be written in Latin letters."
NOTE_CHANGED_ELSEWHERE = "This note changed somewhere else."
NOTE_TOO_LARGE = "This note is too large to save."
NOTE_TOO_DEEP = "This note is nested too deeply."
# Markdown written through the MCP. The caller is an assistant, so the messages say how to fix it.
IMAGE_SOURCE_NOT_ALLOWED = "Images must use an http(s) URL or an existing note-image placeholder."
UNKNOWN_IMAGE_PLACEHOLDER = (
    "Unknown image placeholder {placeholder}. Keep the placeholders exactly as get_note returned them."
)
VERSION_REQUIRED_WITH_BODY = "Version is required when saving the body."
ABILITIES_DISTINCT = "Abilities must not list the same value twice."
ACCESS_TOKEN_LIMIT_REACHED = (
    f"You can have up to {ACTIVE_ACCESS_TOKENS_MAX} access tokens. Revoke one to create another."
)

# The MCP tools. The caller is an assistant, so each message says what to do next.
MCP_ABILITY_MISSING = (
    "This access token does not have the {ability} scope. "
    "Create a token with it under Settings → Access tokens."
)
MCP_NOTE_NOT_FOUND = "No note with that uuid. Use search_notes or list_notes to find it."
MCP_FOLDER_NOT_FOUND = "No folder with that id. Use list_folders to see the folders."
MCP_TAG_NOT_FOUND = "No tag with that id. Use list_tags to see the tags."
MCP_NOTE_IN_TRASH = "This note is in Trash. It can only be restored from the Notes app."
MCP_NOTE_VERSION_CONFLICT = (
    "This note changed since you read it (it is now at version {version}). "
    "Call get_note again and reapply your change to the new content."
)
MCP_NOTHING_TO_CHANGE = "Nothing to change: pass a title, markdown, or both."
MCP_TOO_MANY_TAGS = "A note can have at most {maximum} tags."
