"""Every user-facing message. Messages never contain personal data."""

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
    "json_invalid": "The request body is not valid JSON.",
    "model_attributes_type": "The request body must be a JSON object.",
}

CURRENT_PASSWORD_INCORRECT = "The password is incorrect."  # noqa: S105 - a message
