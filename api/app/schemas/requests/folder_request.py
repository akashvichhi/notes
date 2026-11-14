from typing import Annotated
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common.field_types import FolderName, FolderPosition, HexColor, NotNull


class CreateFolderRequest(BaseModel):
    """The client may choose the uuid, so a create retried after a lost response is safe."""

    uuid: UUID | None = None
    name: FolderName
    parent_uuid: UUID | None = None
    color: HexColor | None = None


class UpdateFolderRequest(BaseModel):
    name: Annotated[FolderName | None, NotNull] = None
    # null clears the colour.
    color: HexColor | None = None
    position: Annotated[FolderPosition | None, NotNull] = None
