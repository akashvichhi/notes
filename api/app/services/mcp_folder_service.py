"""Folders for the MCP tools: the whole tree with note counts, and changes that answer
with the folder's full path. Changes go through FolderService, so the name rules are the
web app's."""

from collections import defaultdict
from uuid import UUID

from app.constants import messages
from app.core.exceptions import NotFoundError
from app.models.folder_model import Folder
from app.models.user_model import User
from app.repositories.folder_repository import FolderRepository
from app.repositories.note_repository import NoteRepository
from app.schemas.requests.folder_request import CreateFolderRequest, UpdateFolderRequest
from app.schemas.resources.mcp_folder_resource import (
    McpFolderNodeResource,
    McpFolderResource,
    McpFolderTreeResource,
)
from app.services.folder_paths import FolderPaths
from app.services.folder_service import FolderService


class McpFolderService:
    def __init__(
        self, folder_service: FolderService, folders: FolderRepository, notes: NoteRepository
    ) -> None:
        self._folder_service = folder_service
        self._folders = folders
        self._notes = notes

    def tree(self, user: User) -> McpFolderTreeResource:
        folders = self._folders.all_of_user(user.id)
        counts = self._notes.active_counts_by_folder(user.id)
        total = self._notes.count_active(user.id)
        ids = {folder.id for folder in folders}
        children: defaultdict[int | None, list[Folder]] = defaultdict(list)
        for folder in folders:
            # A folder whose parent is missing is shown at the top level rather than lost.
            children[folder.parent_id if folder.parent_id in ids else None].append(folder)
        return McpFolderTreeResource(
            folders=_nodes(children, None, counts, frozenset()),
            notes_outside_folders=total - sum(counts.get(folder_id, 0) for folder_id in ids),
            total_notes=total,
        )

    def create(self, user: User, request: CreateFolderRequest) -> McpFolderResource:
        if request.parent_uuid is not None:
            self._existing(user, request.parent_uuid)
        created = self._folder_service.create(user, request).resource
        return self._resource(user, created.uuid)

    def update(self, user: User, folder_uuid: UUID, request: UpdateFolderRequest) -> McpFolderResource:
        self._existing(user, folder_uuid)
        self._folder_service.update(user, folder_uuid, request)
        return self._resource(user, folder_uuid)

    def _existing(self, user: User, folder_uuid: UUID) -> Folder:
        folder = self._folders.find_of_user(user.id, folder_uuid)
        if folder is None:
            raise NotFoundError(messages.MCP_FOLDER_NOT_FOUND)
        return folder

    def _resource(self, user: User, folder_uuid: UUID) -> McpFolderResource:
        folders = self._folders.all_of_user(user.id)
        folder = next(folder for folder in folders if folder.uuid == folder_uuid)
        return McpFolderResource.from_model(folder, FolderPaths(folders).path(folder.id) or folder.name)


def _nodes(
    children: dict[int | None, list[Folder]],
    parent_id: int | None,
    counts: dict[int, int],
    seen: frozenset[int],
) -> list[McpFolderNodeResource]:
    """The folders under parent_id, each with its own children; `seen` stops at a cycle."""
    return [
        McpFolderNodeResource(
            id=folder.uuid,
            name=folder.name,
            color=folder.color,
            position=folder.position,
            note_count=counts.get(folder.id, 0),
            children=_nodes(children, folder.id, counts, seen | {folder.id}),
        )
        for folder in children.get(parent_id, [])
        if folder.id not in seen
    ]
