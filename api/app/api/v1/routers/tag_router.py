"""/api/v1/tags. The tag list comes with /api/v1/bootstrap; a note's tags are set with
PUT /api/v1/notes/{uuid}/tags."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.api.create_response import create_response
from app.api.dependencies import CurrentUser, TagServiceDependency, get_current_user
from app.schemas.common.data_response import DataResponse
from app.schemas.requests.tag_request import CreateTagRequest, RenameTagRequest
from app.schemas.resources.tag_resource import TagResource

tag_router = APIRouter(prefix="/tags", tags=["tags"], dependencies=[Depends(get_current_user)])


@tag_router.post("", status_code=status.HTTP_201_CREATED, response_model=DataResponse[TagResource])
def create_tag(
    body: CreateTagRequest, response: Response, user: CurrentUser, service: TagServiceDependency
) -> DataResponse[TagResource]:
    return create_response(service.create(user, body), response)


@tag_router.patch("/{tag_uuid}", response_model=DataResponse[TagResource])
def rename_tag(
    tag_uuid: UUID, body: RenameTagRequest, user: CurrentUser, service: TagServiceDependency
) -> DataResponse[TagResource]:
    return DataResponse(data=service.rename(user, tag_uuid, body))


@tag_router.delete("/{tag_uuid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_uuid: UUID, user: CurrentUser, service: TagServiceDependency) -> Response:
    service.delete(user, tag_uuid)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
