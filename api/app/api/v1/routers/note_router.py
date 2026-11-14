"""/api/v1/notes and /api/v1/trash."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.create_response import create_response
from app.api.dependencies import CurrentUser, NoteServiceDependency, get_current_user, limit_note_saves
from app.schemas.common.data_response import DataResponse
from app.schemas.common.paginated_response import PaginatedResponse
from app.schemas.requests.note_request import (
    CreateNoteRequest,
    NoteListRequest,
    RestoreNoteRequest,
    SetNoteTagsRequest,
    UpdateNoteRequest,
)
from app.schemas.resources.note_resource import NoteListItemResource, NoteResource

note_router = APIRouter(tags=["notes"], dependencies=[Depends(get_current_user)])


@note_router.get("/notes", response_model=PaginatedResponse[NoteListItemResource])
def list_notes(
    query: Annotated[NoteListRequest, Query()], user: CurrentUser, service: NoteServiceDependency
) -> PaginatedResponse[NoteListItemResource]:
    return service.list(user, query)


@note_router.post("/notes", status_code=status.HTTP_201_CREATED, response_model=DataResponse[NoteResource])
def create_note(
    body: CreateNoteRequest, response: Response, user: CurrentUser, service: NoteServiceDependency
) -> DataResponse[NoteResource]:
    return create_response(service.create(user, body), response)


@note_router.get("/notes/{note_uuid}", response_model=DataResponse[NoteResource])
def get_note(
    note_uuid: UUID, user: CurrentUser, service: NoteServiceDependency
) -> DataResponse[NoteResource]:
    return DataResponse(data=service.get(user, note_uuid))


@note_router.patch(
    "/notes/{note_uuid}",
    response_model=DataResponse[NoteResource],
    dependencies=[Depends(limit_note_saves)],
)
def update_note(
    note_uuid: UUID, body: UpdateNoteRequest, user: CurrentUser, service: NoteServiceDependency
) -> DataResponse[NoteResource]:
    return DataResponse(data=service.update(user, note_uuid, body))


@note_router.delete("/notes/{note_uuid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_uuid: UUID, user: CurrentUser, service: NoteServiceDependency, force: bool = False
) -> Response:
    service.delete(user, note_uuid, force)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@note_router.post(
    "/notes/{note_uuid}/duplicate",
    status_code=status.HTTP_201_CREATED,
    response_model=DataResponse[NoteResource],
)
def duplicate_note(
    note_uuid: UUID, user: CurrentUser, service: NoteServiceDependency
) -> DataResponse[NoteResource]:
    return DataResponse(data=service.duplicate(user, note_uuid))


@note_router.put("/notes/{note_uuid}/tags", response_model=DataResponse[NoteResource])
def set_note_tags(
    note_uuid: UUID, body: SetNoteTagsRequest, user: CurrentUser, service: NoteServiceDependency
) -> DataResponse[NoteResource]:
    return DataResponse(data=service.set_tags(user, note_uuid, body))


@note_router.post("/notes/{note_uuid}/restore", response_model=DataResponse[NoteResource])
def restore_note(
    note_uuid: UUID, user: CurrentUser, service: NoteServiceDependency, body: RestoreNoteRequest | None = None
) -> DataResponse[NoteResource]:
    # The body is optional: an empty request restores the note where it was.
    return DataResponse(data=service.restore(user, note_uuid, body or RestoreNoteRequest()))


@note_router.delete("/trash", status_code=status.HTTP_204_NO_CONTENT)
def empty_trash(user: CurrentUser, service: NoteServiceDependency) -> Response:
    service.empty_trash(user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
