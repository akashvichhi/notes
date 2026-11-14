"""/api/v1/folders. The folder list comes with /api/v1/bootstrap."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.api.create_response import create_response
from app.api.dependencies import CurrentUser, FolderServiceDependency, get_current_user
from app.schemas.common.data_response import DataResponse
from app.schemas.requests.folder_request import CreateFolderRequest, UpdateFolderRequest
from app.schemas.resources.folder_resource import FolderResource

folder_router = APIRouter(prefix="/folders", tags=["folders"], dependencies=[Depends(get_current_user)])


@folder_router.post("", status_code=status.HTTP_201_CREATED, response_model=DataResponse[FolderResource])
def create_folder(
    body: CreateFolderRequest, response: Response, user: CurrentUser, service: FolderServiceDependency
) -> DataResponse[FolderResource]:
    return create_response(service.create(user, body), response)


@folder_router.patch("/{folder_uuid}", response_model=DataResponse[FolderResource])
def update_folder(
    folder_uuid: UUID, body: UpdateFolderRequest, user: CurrentUser, service: FolderServiceDependency
) -> DataResponse[FolderResource]:
    return DataResponse(data=service.update(user, folder_uuid, body))


@folder_router.delete("/{folder_uuid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_uuid: UUID, user: CurrentUser, service: FolderServiceDependency) -> Response:
    service.delete(user, folder_uuid)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
