from pydantic import BaseModel, Field, SerializeAsAny


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    error: str
    # Left out of the body when there are none; other fields keep their nulls.
    details: list[ErrorDetail] | None = Field(default=None, exclude_if=lambda details: details is None)


class NoteConflictResponse(ErrorResponse):
    """A body save that lost the version race: the note as it now is, so the editor can
    offer both versions without another request."""

    server_copy: SerializeAsAny[BaseModel]
