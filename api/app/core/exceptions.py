"""Domain exceptions. Services raise these; core/exception_handlers.py turns them into
the error shape. A subclass with a richer body (the note conflict's server copy)
overrides to_response()."""

from collections.abc import Mapping
from http import HTTPStatus
from typing import Self

from pydantic import BaseModel

from app.constants import messages
from app.schemas.common.error_response import ErrorDetail, ErrorResponse


class DomainError(Exception):
    status_code: HTTPStatus = HTTPStatus.BAD_REQUEST
    default_message: str = messages.SERVER_ERROR

    def __init__(self, message: str | None = None, details: list[ErrorDetail] | None = None) -> None:
        self.message = message or self.default_message
        self.details = details
        super().__init__(self.message)

    @classmethod
    def for_field(cls, field: str, message: str) -> Self:
        """An error about one input, so the web app can show it next to that field."""
        return cls(messages.VALIDATION_FAILED, [ErrorDetail(field=field, message=message)])

    @property
    def headers(self) -> Mapping[str, str]:
        return {}

    def to_response(self) -> BaseModel:
        return ErrorResponse(error=self.message, details=self.details)


class DomainValidationError(DomainError):
    status_code = HTTPStatus.UNPROCESSABLE_CONTENT
    default_message = messages.VALIDATION_FAILED


class UnauthenticatedError(DomainError):
    status_code = HTTPStatus.UNAUTHORIZED
    default_message = messages.UNAUTHENTICATED


class ForbiddenError(DomainError):
    status_code = HTTPStatus.FORBIDDEN
    default_message = messages.FORBIDDEN


class NotFoundError(DomainError):
    status_code = HTTPStatus.NOT_FOUND
    default_message = messages.NOT_FOUND


class ConflictError(DomainError):
    status_code = HTTPStatus.CONFLICT
    default_message = messages.CONFLICT


class RateLimitedError(DomainError):
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    default_message = messages.TOO_MANY_REQUESTS

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__()
        self.retry_after_seconds = retry_after_seconds

    @property
    def headers(self) -> Mapping[str, str]:
        return {"Retry-After": str(self.retry_after_seconds)}
