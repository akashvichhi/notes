from pydantic import BaseModel


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    error: str
    details: list[ErrorDetail] | None = None
