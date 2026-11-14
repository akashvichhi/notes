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
