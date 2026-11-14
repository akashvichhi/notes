"""The data the app opens with: the account, every folder and tag, note counts and the
first page of notes."""

from app.constants.note_constants import BOOTSTRAP_NOTES_MAX
from app.models.folder_model import Folder
from app.models.tag_model import Tag
from app.models.user_model import User
from app.repositories.folder_repository import FolderRepository
from app.repositories.note_repository import NoteRepository
from app.repositories.tag_repository import TagRepository
from app.schemas.resources.bootstrap_resource import (
    BootstrapResource,
    FolderCountResource,
    NoteCountsResource,
    TagCountResource,
)
from app.schemas.resources.folder_resource import FolderResource
from app.schemas.resources.note_resource import NoteListItemResource
from app.schemas.resources.tag_resource import TagResource
from app.schemas.resources.user_resource import UserResource


class BootstrapService:
    def __init__(self, notes: NoteRepository, folders: FolderRepository, tags: TagRepository) -> None:
        self._notes = notes
        self._folders = folders
        self._tags = tags

    def build(self, user: User) -> BootstrapResource:
        folders = self._folders.all_of_user(user.id)
        tags = self._tags.all_of_user(user.id)
        return BootstrapResource(
            user=UserResource.from_model(user),
            folders=_folder_resources(folders),
            tags=[TagResource.from_model(tag) for tag in tags],
            counts=self._counts(user, folders, tags),
            notes=[
                NoteListItemResource.from_model(note)
                for note in self._notes.newest(user.id, BOOTSTRAP_NOTES_MAX)
            ],
        )

    def _counts(self, user: User, folders: list[Folder], tags: list[Tag]) -> NoteCountsResource:
        # Two grouped queries, not one per folder or tag.
        by_folder = self._notes.active_counts_by_folder(user.id)
        by_tag = self._notes.active_counts_by_tag(user.id)
        return NoteCountsResource(
            all=self._notes.count_active(user.id),
            starred=self._notes.count_starred(user.id),
            trashed=self._notes.count_trashed(user.id),
            folders=[
                FolderCountResource(uuid=folder.uuid, count=by_folder.get(folder.id, 0)) for folder in folders
            ],
            tags=[TagCountResource(slug=tag.slug, count=by_tag.get(tag.id, 0)) for tag in tags],
        )


def _folder_resources(folders: list[Folder]) -> list[FolderResource]:
    """Parents are looked up in the list itself: every folder of the user is in it."""
    uuid_by_id = {folder.id: folder.uuid for folder in folders}
    return [
        FolderResource.from_model(folder, None if folder.parent_id is None else uuid_by_id[folder.parent_id])
        for folder in folders
    ]
