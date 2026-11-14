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

# Auth. One message for a wrong email and a wrong password: it never says which.
INVALID_CREDENTIALS = "These credentials do not match our records."
EMAIL_TAKEN = "The email has already been taken."
PASSWORD_CONFIRMATION_MISMATCH = "The password field confirmation does not match."  # noqa: S105 - a message

# Validation messages by Pydantic error type. {label} is the field's name in words
# ("per_page" -> "per page"); the other placeholders come from the error's context.
VALIDATION_MESSAGE_TEMPLATES: dict[str, str] = {
    "missing": "The {label} field is required.",
    "required": "The {label} field is required.",
    "string_too_short": "The {label} field must be at least {min_length} characters.",
    "string_too_long": "The {label} field must not be greater than {max_length} characters.",
    "string_type": "The {label} field must be a string.",
    "email": "The {label} field must be a valid email address.",
    "int_type": "The {label} field must be an integer.",
    "int_parsing": "The {label} field must be an integer.",
    "bool_type": "The {label} field must be true or false.",
    "bool_parsing": "The {label} field must be true or false.",
    "uuid_type": "The {label} field must be a valid UUID.",
    "uuid_parsing": "The {label} field must be a valid UUID.",
    "greater_than_equal": "The {label} field must be at least {ge}.",
    "less_than_equal": "The {label} field must not be greater than {le}.",
    "enum": "The selected {label} is invalid.",
    "literal_error": "The selected {label} is invalid.",
    "dict_type": "The {label} field must be an object.",
    "list_type": "The {label} field must be a list.",
    "too_long": "The {label} field must not have more than {max_length} items.",
    "too_short": "The {label} field must have at least {min_length} item.",
    "json_invalid": "The request body is not valid JSON.",
    "model_attributes_type": "The request body must be a JSON object.",
    "string_pattern_mismatch": "The {label} field format is invalid.",
}

CURRENT_PASSWORD_INCORRECT = "The password is incorrect."  # noqa: S105 - a message
NAME_TAKEN = "The name has already been taken."
TAG_NAME_WITHOUT_SLUG = "The name must contain a letter or number that has a Latin spelling."
NOTE_CHANGED_ELSEWHERE = "This note changed somewhere else."
NOTE_TOO_LARGE = "This note is too large to save."
NOTE_TOO_DEEP = "This note is nested too deeply."
# Markdown written through the MCP. The caller is an assistant, so the messages say how to fix it.
IMAGE_SOURCE_NOT_ALLOWED = "Images must use an http(s) URL or an existing note-image placeholder."
UNKNOWN_IMAGE_PLACEHOLDER = (
    "Unknown image placeholder {placeholder}. Keep the placeholders exactly as get_note returned them."
)
VERSION_REQUIRED_WITH_BODY = "The version field is required when body is present."
ABILITIES_DISTINCT = "The abilities field has a duplicate value."
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
