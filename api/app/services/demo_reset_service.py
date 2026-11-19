"""Puts the public demo account back to its sample content, so a visitor who changes or
deletes it never breaks the demo for the next one (decision 14). One transaction: if any
step fails, the account keeps the content it had."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.content.demo_content import DemoContent, DemoNote
from app.core.security import PasswordHasher
from app.models.folder_model import Folder
from app.models.note_model import Note
from app.models.tag_model import Tag
from app.models.user_model import User
from app.repositories.access_token_repository import AccessTokenRepository
from app.repositories.folder_repository import FolderRepository
from app.repositories.note_repository import NoteRepository
from app.repositories.tag_repository import TagRepository
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.services.note_service import apply_note_body
from app.services.tag_service import TagService


@dataclass(frozen=True)
class DemoAccount:
    email: str
    password: str
    name: str


@dataclass(frozen=True)
class DemoResetResult:
    """Ids and counts only: what the nightly log may show."""

    user_id: int
    created: bool
    folders: int
    tags: int
    notes: int


class DemoResetService:
    def __init__(
        self,
        db: Session,
        users: UserRepository,
        sessions: UserSessionRepository,
        tokens: AccessTokenRepository,
        notes: NoteRepository,
        folders: FolderRepository,
        tags: TagRepository,
        tag_service: TagService,
        hasher: PasswordHasher,
        content: DemoContent,
    ) -> None:
        self._db = db
        self._users = users
        self._sessions = sessions
        self._tokens = tokens
        self._notes = notes
        self._folders = folders
        self._tags = tags
        self._tag_service = tag_service
        self._hasher = hasher
        self._content = content

    def reset(self, account: DemoAccount) -> DemoResetResult:
        try:
            result = self._reset(account)
            self._db.commit()
        except Exception:
            self._db.rollback()
            raise
        return result

    def _reset(self, account: DemoAccount) -> DemoResetResult:
        user, created = self._account(account)
        self._clear(user)
        folder_ids = self._add_folders(user)
        tag_ids: set[int] = set()
        # Newest first in the note list, and every sample note has the same timestamps,
        # so the higher id comes first: the file's first note is written last.
        for sample in reversed(self._content.notes):
            tags = self._add_note(user, sample, folder_ids)
            tag_ids.update(tag.id for tag in tags)
        return DemoResetResult(
            user_id=user.id,
            created=created,
            folders=len(folder_ids),
            tags=len(tag_ids),
            notes=len(self._content.notes),
        )

    def _account(self, account: DemoAccount) -> tuple[User, bool]:
        password_hash = self._hasher.hash(account.password)
        user = self._users.find_by_email(account.email)
        if user is None:
            new_user = User(name=account.name, email=account.email, password_hash=password_hash)
            return self._users.add(new_user), True
        user.name = account.name
        user.password_hash = password_hash
        return user, False

    def _clear(self, user: User) -> None:
        """Signs every visitor out and removes everything they could have changed."""
        self._sessions.delete_all_of_user(user.id)
        self._tokens.delete_all_of_user(user.id)
        self._notes.delete_all_of_user(user.id)
        self._folders.delete_all_of_user(user.id)
        self._tags.delete_all_of_user(user.id)

    def _add_folders(self, user: User) -> dict[str, int]:
        added = [
            self._folders.add(Folder(user_id=user.id, name=name, position=position))
            for position, name in enumerate(self._content.folders)
        ]
        return {folder.name: folder.id for folder in added}

    def _add_note(self, user: User, sample: DemoNote, folder_ids: dict[str, int]) -> list[Tag]:
        note = Note(
            user_id=user.id,
            folder_id=None if sample.folder is None else folder_ids[sample.folder],
            # The title follows the first heading, as for a note written in the editor.
            title_locked=False,
            is_starred=sample.starred,
            version=1,
        )
        apply_note_body(note, sample.body)
        note.tags = self._tag_service.resolve_names(user, list(sample.tags))
        self._notes.add(note)
        return note.tags
