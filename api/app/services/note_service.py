"""Notes: saving with an optimistic version, the title rules, tags and the trash."""

import copy
import json
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants.note_constants import EMPTY_DOCUMENT_JSON, NOTE_COPY_SUFFIX, NOTE_TITLE_MAX_LENGTH
from app.content.note_text import derive_note_text
from app.content.search_terms import parse_search_terms
from app.core.clock import Clock
from app.core.exceptions import ConflictError, NoteConflictError, NotFoundError
from app.models.note_model import Note
from app.models.user_model import User
from app.repositories.folder_repository import FolderRepository
from app.repositories.note_repository import NoteRepository
from app.schemas.common.json_types import JsonObject
from app.schemas.common.paginated_response import PaginatedResponse
from app.schemas.requests.note_request import (
    CreateNoteRequest,
    NoteListRequest,
    RestoreNoteRequest,
    SetNoteTagsRequest,
    UpdateNoteRequest,
    WriteNoteRequest,
)
from app.schemas.resources.note_resource import NoteListItemResource, NoteResource
from app.services.create_result import CreateResult
from app.services.tag_service import TagService


class NoteService:
    def __init__(
        self, db: Session, notes: NoteRepository, folders: FolderRepository, tags: TagService, clock: Clock
    ) -> None:
        self._db = db
        self._notes = notes
        self._folders = folders
        self._tags = tags
        self._clock = clock

    def list(self, user: User, request: NoteListRequest) -> PaginatedResponse[NoteListItemResource]:
        folder_id = self._folder_id(user, request.folder_id)
        search_terms = parse_search_terms(request.q) if request.q else []
        if request.q and not search_terms:
            # Words this short match nothing, as in the search endpoint.
            return PaginatedResponse[NoteListItemResource].create([], 0, request)
        notes, total_count = self._notes.page(user.id, request, folder_id, search_terms)
        items = [NoteListItemResource.from_model(note) for note in notes]
        return PaginatedResponse[NoteListItemResource].create(items, total_count, request)

    def get(self, user: User, note_uuid: UUID) -> NoteResource:
        return NoteResource.from_model(self._get(user, note_uuid))

    def create(self, user: User, request: CreateNoteRequest) -> CreateResult[NoteResource]:
        if request.uuid is not None:
            existing = self._notes.find_by_uuid(request.uuid)
            if existing is not None:
                if existing.user_id != user.id:
                    raise ConflictError
                return CreateResult(self._resource(existing.id), created=False)
        note = Note(
            user_id=user.id,
            folder_id=self._folder_id(user, request.folder_id),
            title_locked=False,
            is_starred=False,
            version=1,
        )
        if request.uuid is not None:
            note.uuid = request.uuid
        apply_note_body(note, json.loads(EMPTY_DOCUMENT_JSON))
        note_id = self._notes.add(note).id
        self._commit()
        return CreateResult(self._resource(note_id), created=True)

    def write(self, user: User, request: WriteNoteRequest) -> NoteResource:
        """Creates a note with its title, body, folder and tags in one transaction."""
        note = Note(
            user_id=user.id,
            folder_id=self._folder_id(user, request.folder_id),
            title=request.title,
            title_locked=True,
            is_starred=False,
            version=1,
        )
        apply_note_body(note, request.body if request.body is not None else json.loads(EMPTY_DOCUMENT_JSON))
        note.tags = self._tags.resolve_names(user, request.tag_names)
        return self._commit_and_load(self._notes.add(note).id)

    def update(self, user: User, note_uuid: UUID, request: UpdateNoteRequest) -> NoteResource:
        """A body save must name the version it edited; if the note moved on (or went to the
        Trash) meanwhile, it is refused with the current note, so nothing is overwritten."""
        note = self._get(user, note_uuid)
        if request.body is not None:
            note = self._notes.lock(note.id)
            if note.deleted_at is not None or note.version != request.version:
                raise NoteConflictError(NoteResource.from_model(note))
            apply_note_body(note, request.body)
            note.version += 1
        # After the body, so a title sent with it wins over the derived one.
        if request.title is not None:
            note.title = request.title
            note.title_locked = True
        if "folder_id" in request.model_fields_set:
            note.folder_id = self._folder_id(user, request.folder_id)
        if request.is_starred is not None:
            note.is_starred = request.is_starred
        return self._commit_and_load(note.id)

    def duplicate(self, user: User, note_uuid: UUID) -> NoteResource:
        """The copy keeps the body, folder, star and tags, under "<title> (copy)". A copy with
        a title has it locked, so editing the copy's body never renames it."""
        source = self._get(user, note_uuid)
        title = _copy_title(source.title)
        duplicate = Note(
            user_id=user.id,
            folder_id=source.folder_id,
            title=title,
            title_locked=title != "",
            body=copy.deepcopy(source.body),
            plain_text=source.plain_text,
            excerpt=source.excerpt,
            word_count=source.word_count,
            is_starred=source.is_starred,
            version=1,
        )
        duplicate.tags = list(source.tags)
        return self._commit_and_load(self._notes.add(duplicate).id)

    def set_tags(self, user: User, note_uuid: UUID, request: SetNoteTagsRequest) -> NoteResource:
        note = self._get(user, note_uuid)
        note.tags = self._tags.resolve_names(user, request.names)
        return self._commit_and_load(note.id)

    def delete(self, user: User, note_uuid: UUID, force: bool) -> None:
        """Moves the note to the Trash, or with force removes it for good."""
        note = self._get(user, note_uuid)
        if force:
            self._notes.delete(note)
        elif note.deleted_at is None:
            note.deleted_at = self._clock.now()
        self._db.commit()

    def restore(self, user: User, note_uuid: UUID, request: RestoreNoteRequest) -> NoteResource:
        note = self._get(user, note_uuid)
        if request.folder_id is not None:
            note.folder_id = self._folder_id(user, request.folder_id)
        note.deleted_at = None
        return self._commit_and_load(note.id)

    def empty_trash(self, user: User) -> None:
        self._notes.delete_trashed(user.id)
        self._db.commit()

    def _get(self, user: User, note_uuid: UUID) -> Note:
        note = self._notes.find_of_user(user.id, note_uuid)
        if note is None:
            raise NotFoundError
        return note

    def _folder_id(self, user: User, folder_uuid: UUID | None) -> int | None:
        if folder_uuid is None:
            return None
        folder = self._folders.find_of_user(user.id, folder_uuid)
        if folder is None:
            raise NotFoundError
        return folder.id

    def _resource(self, note_id: int) -> NoteResource:
        return NoteResource.from_model(self._notes.load(note_id))

    def _commit_and_load(self, note_id: int) -> NoteResource:
        self._commit()
        return self._resource(note_id)

    def _commit(self) -> None:
        try:
            self._db.commit()
        except IntegrityError:
            # A concurrent create took the uuid, or the folder went, between check and write.
            self._db.rollback()
            raise ConflictError from None


def apply_note_body(note: Note, body: JsonObject) -> None:
    """Stores the body and what is derived from it; the title follows the body until the
    user sets one."""
    text = derive_note_text(body)
    note.body = body
    note.plain_text = text.plain_text
    note.excerpt = text.excerpt
    note.word_count = text.word_count
    if not note.title_locked:
        note.title = text.title


def _copy_title(title: str) -> str:
    if title == "":
        return ""
    # Shortened before the suffix, so the copy still fits and still says "(copy)".
    return title[: NOTE_TITLE_MAX_LENGTH - len(NOTE_COPY_SUFFIX)] + NOTE_COPY_SUFFIX
