"""Folders: a tree per user, with names unique among siblings."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants import messages
from app.constants.folder_constants import FIRST_DUPLICATE_SUFFIX_NUMBER, FOLDER_NAME_MAX_LENGTH
from app.core.exceptions import ConflictError, NotFoundError
from app.models.folder_model import Folder
from app.models.user_model import User
from app.repositories.folder_repository import FolderRepository
from app.schemas.requests.folder_request import CreateFolderRequest, UpdateFolderRequest
from app.schemas.resources.folder_resource import FolderResource


@dataclass(frozen=True)
class CreatedFolder:
    folder: FolderResource
    # False when the uuid already named this user's folder (a retried create).
    created: bool


class FolderService:
    def __init__(self, db: Session, folders: FolderRepository) -> None:
        self._db = db
        self._folders = folders

    def create(self, user: User, request: CreateFolderRequest) -> CreatedFolder:
        if request.uuid is not None:
            existing = self._folders.find_by_uuid(request.uuid)
            if existing is not None:
                if existing.user_id != user.id:
                    raise ConflictError
                return CreatedFolder(self._resource(existing), created=False)
        parent_id = self._parent_id(user, request.parent_uuid)
        self._ensure_name_is_free(user.id, parent_id, request.name)
        folder = Folder(user_id=user.id, parent_id=parent_id, name=request.name, color=request.color)
        if request.uuid is not None:
            folder.uuid = request.uuid
        self._folders.add(folder)
        self._commit()
        return CreatedFolder(self._resource(folder), created=True)

    def update(self, user: User, folder_uuid: UUID, request: UpdateFolderRequest) -> FolderResource:
        folder = self._get(user, folder_uuid)
        changes = request.model_dump(exclude_unset=True)
        name = changes.get("name")
        if name is not None:
            self._ensure_name_is_free(user.id, folder.parent_id, name, exclude_id=folder.id)
        for field, value in changes.items():
            setattr(folder, field, value)
        self._commit()
        return self._resource(folder)

    def delete(self, user: User, folder_uuid: UUID) -> None:
        """Its notes move to the top level (the notes' key is ON DELETE SET NULL) and its
        child folders move up to its parent. The folder goes first, so a child may take its
        name; the parent key is deferred until the children have moved."""
        folder = self._get(user, folder_uuid)
        children = self._folders.children_of(folder.id)
        new_parent_id = folder.parent_id
        self._folders.delete(folder)
        for child in children:
            child.name = self._free_name(user.id, new_parent_id, child.name)
            child.parent_id = new_parent_id
            self._folders.flush()
        self._folders.check_deferred_constraints()
        self._commit()

    def _get(self, user: User, folder_uuid: UUID) -> Folder:
        folder = self._folders.find_of_user(user.id, folder_uuid)
        if folder is None:
            raise NotFoundError
        return folder

    def _parent_id(self, user: User, parent_uuid: UUID | None) -> int | None:
        if parent_uuid is None:
            return None
        return self._get(user, parent_uuid).id

    def _ensure_name_is_free(
        self, user_id: int, parent_id: int | None, name: str, exclude_id: int | None = None
    ) -> None:
        if self._folders.name_taken(user_id, parent_id, name, exclude_id):
            raise ConflictError.for_field("name", messages.NAME_TAKEN)

    def _free_name(self, user_id: int, parent_id: int | None, name: str) -> str:
        """The name itself, or "Name (2)", "Name (3)", ... whichever is free first."""
        candidate = name
        number = FIRST_DUPLICATE_SUFFIX_NUMBER
        while self._folders.name_taken(user_id, parent_id, candidate):
            suffix = f" ({number})"
            candidate = f"{name[: FOLDER_NAME_MAX_LENGTH - len(suffix)]}{suffix}"
            number += 1
        return candidate

    def _resource(self, folder: Folder) -> FolderResource:
        return FolderResource.from_model(folder, self._folders.uuid_of(folder.parent_id))

    def _commit(self) -> None:
        try:
            self._db.commit()
        except IntegrityError:
            # A concurrent request took the name or uuid between the check and the write.
            self._db.rollback()
            raise ConflictError from None
