"""Every error leaves the API in the contract's shape: {"error": ..., "details"?: [...]}.
Framework defaults ({"detail": ...}) never reach a client."""

import logging
from collections.abc import Mapping
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse, PlainTextResponse, Response

from app.constants import messages
from app.constants.http_constants import ASSETS_PATH_PREFIX, PAGE_METHODS
from app.core.exceptions import DomainError
from app.core.frontend import Frontend
from app.schemas.common.error_response import ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)

STATUS_MESSAGES: dict[int, str] = {
    HTTPStatus.UNAUTHORIZED: messages.UNAUTHENTICATED,
    HTTPStatus.FORBIDDEN: messages.FORBIDDEN,
    HTTPStatus.NOT_FOUND: messages.NOT_FOUND,
    HTTPStatus.METHOD_NOT_ALLOWED: messages.METHOD_NOT_ALLOWED,
    HTTPStatus.TOO_MANY_REQUESTS: messages.TOO_MANY_REQUESTS,
}


def error_json(body: BaseModel, status_code: int, headers: Mapping[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        body.model_dump(mode="json", exclude_none=True), status_code=status_code, headers=headers
    )


def _validation_detail(error: dict[str, object]) -> ErrorDetail:
    location = error.get("loc", ())
    parts = [str(part) for part in location] if isinstance(location, tuple | list) else []
    # The first part says where the input was (body, query, path); the field is the rest.
    field = ".".join(parts[1:]) or (parts[0] if parts else "")
    message = str(error.get("msg", messages.VALIDATION_FAILED)).removeprefix(
        messages.PYDANTIC_VALUE_ERROR_PREFIX
    )
    return ErrorDetail(field=field, message=message)


def handle_validation_error(_request: Request, exc: Exception) -> Response:
    assert isinstance(exc, RequestValidationError)  # noqa: S101 - narrows the type FastAPI registers
    details = [_validation_detail(dict(error)) for error in exc.errors()]
    return error_json(
        ErrorResponse(error=messages.VALIDATION_FAILED, details=details), HTTPStatus.UNPROCESSABLE_CONTENT
    )


def handle_domain_error(_request: Request, exc: Exception) -> Response:
    assert isinstance(exc, DomainError)  # noqa: S101 - narrows the type FastAPI registers
    return error_json(exc.to_response(), exc.status_code, exc.headers)


def handle_http_error(request: Request, exc: Exception) -> Response:
    assert isinstance(exc, StarletteHTTPException)  # noqa: S101 - narrows the type FastAPI registers
    path = request.url.path
    if exc.status_code == HTTPStatus.NOT_FOUND and request.method in PAGE_METHODS:
        frontend: Frontend = request.app.state.frontend
        if frontend.serves_page(path):
            return frontend.page_response(path)
        if path.startswith(ASSETS_PATH_PREFIX):
            return PlainTextResponse(HTTPStatus.NOT_FOUND.phrase, status_code=HTTPStatus.NOT_FOUND)
    message = STATUS_MESSAGES.get(exc.status_code, HTTPStatus(exc.status_code).phrase)
    return error_json(ErrorResponse(error=message), exc.status_code, exc.headers)


def handle_unexpected_error(request: Request, exc: Exception) -> Response:
    # The route template only: a raw path or a body could contain personal data.
    route = getattr(request.scope.get("route"), "path", "-")
    logger.error("Unhandled error on %s %s", request.method, route, exc_info=exc)
    return error_json(ErrorResponse(error=messages.SERVER_ERROR), HTTPStatus.INTERNAL_SERVER_ERROR)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(DomainError, handle_domain_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_error)
    app.add_exception_handler(Exception, handle_unexpected_error)
