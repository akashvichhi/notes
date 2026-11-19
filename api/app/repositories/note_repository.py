"""Notes. Trashed notes have deleted_at set; every query starts from _scoped(), the one
place that filter lives."""

from collections.abc import Sequence
from enum import Enum, auto
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Select, UnaryExpression, cast, delete, func, select
from sqlalchemy.dialects.postgresql import REGCONFIG
from sqlalchemy.orm import Session, load_only, selectinload
from sqlalchemy.orm.interfaces import LoaderOption

from app.constants.database_constants import SEARCH_TEXT_CONFIG
from app.constants.note_constants import NoteSort
from app.models.note_model import Note, note_tag
from app.models.tag_model import Tag
from app.schemas.requests.note_request import NoteListRequest


class NoteScope(Enum):
    ACTIVE = auto()
    TRASHED = auto()
    ANY = auto()


def _scoped(scope: NoteScope) -> Select[Note]:
    query = select(Note)
    if scope is NoteScope.ACTIVE:
        return query.where(Note.deleted_at.is_(None))
    if scope is NoteScope.TRASHED:
        return query.where(Note.deleted_at.is_not(None))
    return query


# Newest first for the dates, A to Z for titles; id breaks ties so pages never overlap.
_ORDER_BY: dict[NoteSort, tuple[UnaryExpression[Any], ...]] = {
    NoteSort.UPDATED: (Note.updated_at.desc(), Note.id.desc()),
    NoteSort.CREATED: (Note.created_at.desc(), Note.id.desc()),
    NoteSort.TITLE: (Note.title.asc(), Note.id.asc()),
}

_NEWEST_FIRST = _ORDER_BY[NoteSort.UPDATED]


def _prefix_query(terms: Sequence[str]) -> str:
    """A tsquery where every term must start a word. Each term is quoted, so characters
    like & | ! ( : are text, never operators."""
    quoted = ("'" + term.replace("\\", "\\\\").replace("'", "''") + "':*" for term in terms)
    return " & ".join(quoted)


def _matches_terms(terms: Sequence[str]) -> ColumnElement[bool]:
    """The note's title or text has a word starting with each term."""
    query = func.to_tsquery(cast(SEARCH_TEXT_CONFIG, REGCONFIG), _prefix_query(terms))
    return Note.search_vector.bool_op("@@")(query)


_WITH_RELATIONS: tuple[LoaderOption, ...] = (selectinload(Note.folder), selectinload(Note.tags))


class NoteRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_by_uuid(self, note_uuid: UUID) -> Note | None:
        """Any owner's note: only for telling a reused uuid apart from a free one."""
        return self._session.scalar(_scoped(NoteScope.ANY).where(Note.uuid == note_uuid))

    def find_of_user(self, user_id: int, note_uuid: UUID) -> Note | None:
        """Active or trashed: a trashed note can still be opened and restored."""
        return self._session.scalar(
            _scoped(NoteScope.ANY)
            .where(Note.user_id == user_id, Note.uuid == note_uuid)
            .options(*_WITH_RELATIONS)
        )

    def lock(self, note_id: int) -> Note:
        """Re-reads the note under FOR UPDATE, so two saves of one note take turns."""
        note = self._session.scalar(
            _scoped(NoteScope.ANY)
            .where(Note.id == note_id)
            .with_for_update(of=Note)
            .options(*_WITH_RELATIONS)
            .execution_options(populate_existing=True)
        )
        if note is None:
            raise LookupError(note_id)
        return note

    def load(self, note_id: int) -> Note:
        """Fresh from the database, relations included: after a commit, updated_at and the
        tags are whatever the database now holds."""
        note = self._session.scalar(
            _scoped(NoteScope.ANY)
            .where(Note.id == note_id)
            .options(*_WITH_RELATIONS)
            .execution_options(populate_existing=True)
        )
        if note is None:
            raise LookupError(note_id)
        return note

    def page(
        self,
        user_id: int,
        request: NoteListRequest,
        folder_id: int | None,
        search_terms: Sequence[str] = (),
    ) -> tuple[Sequence[Note], int]:
        scope = NoteScope.TRASHED if request.trashed else NoteScope.ACTIVE
        query = _scoped(scope).where(Note.user_id == user_id)
        if search_terms:
            query = query.where(_matches_terms(search_terms))
        if folder_id is not None:
            query = query.where(Note.folder_id == folder_id)
        if request.starred:
            query = query.where(Note.is_starred.is_(True))
        if request.tag is not None:
            query = query.where(Note.tags.any(Tag.slug == request.tag))
        total = self._count(query)
        items = self._session.scalars(
            query.order_by(*_ORDER_BY[request.sort])
            .offset(request.offset)
            .limit(request.per_page)
            .options(*_WITH_RELATIONS)
        ).all()
        return items, total

    def newest(self, user_id: int, limit: int) -> Sequence[Note]:
        return self._session.scalars(
            _scoped(NoteScope.ACTIVE)
            .where(Note.user_id == user_id)
            .order_by(*_NEWEST_FIRST)
            .limit(limit)
            .options(*_WITH_RELATIONS)
        ).all()

    def search(self, user_id: int, terms: Sequence[str], limit: int) -> Sequence[Note]:
        """Active notes whose title or text has a word starting with each term, newest
        edit first. Only the columns a search result shows are loaded."""
        return self._session.scalars(
            _scoped(NoteScope.ACTIVE)
            .where(Note.user_id == user_id, _matches_terms(terms))
            .order_by(*_NEWEST_FIRST)
            .limit(limit)
            .options(load_only(Note.uuid, Note.title, Note.plain_text))
        ).all()

    def active_by_uuids(self, user_id: int, note_uuids: Sequence[UUID]) -> dict[UUID, Note]:
        """The user's active notes among these uuids, relations included, by uuid."""
        notes = self._session.scalars(
            _scoped(NoteScope.ACTIVE)
            .where(Note.user_id == user_id, Note.uuid.in_(note_uuids))
            .options(*_WITH_RELATIONS)
            # A search loads only a few columns of these notes; this load fills in the rest.
            .execution_options(populate_existing=True)
        ).all()
        return {note.uuid: note for note in notes}

    def count_active(self, user_id: int) -> int:
        return self._count(_scoped(NoteScope.ACTIVE).where(Note.user_id == user_id))

    def count_starred(self, user_id: int) -> int:
        return self._count(
            _scoped(NoteScope.ACTIVE).where(Note.user_id == user_id, Note.is_starred.is_(True))
        )

    def count_trashed(self, user_id: int) -> int:
        return self._count(_scoped(NoteScope.TRASHED).where(Note.user_id == user_id))

    def active_counts_by_folder(self, user_id: int) -> dict[int, int]:
        """Folder id to its number of active notes; folders without notes are missing."""
        rows = self._session.execute(
            _scoped(NoteScope.ACTIVE)
            .where(Note.user_id == user_id, Note.folder_id.is_not(None))
            .with_only_columns(Note.folder_id, func.count())
            .group_by(Note.folder_id)
        ).all()
        return {folder_id: count for folder_id, count in rows if folder_id is not None}

    def active_counts_by_tag(self, user_id: int) -> dict[int, int]:
        """Tag id to its number of active notes; tags without notes are missing."""
        rows = (
            self._session.execute(
                _scoped(NoteScope.ACTIVE)
                .join(note_tag, note_tag.c.note_id == Note.id)
                .where(Note.user_id == user_id)
                .with_only_columns(note_tag.c.tag_id, func.count())
                .group_by(note_tag.c.tag_id)
            )
            .tuples()
            .all()
        )
        return dict(rows)

    def add(self, note: Note) -> Note:
        self._session.add(note)
        self._session.flush()
        return note

    def delete(self, note: Note) -> None:
        # Its note_tag rows go with it (ON DELETE CASCADE).
        self._session.delete(note)
        self._session.flush()

    def delete_trashed(self, user_id: int) -> None:
        trashed_ids = _scoped(NoteScope.TRASHED).where(Note.user_id == user_id).with_only_columns(Note.id)
        self._session.execute(delete(Note).where(Note.id.in_(trashed_ids)))

    def delete_all_of_user(self, user_id: int) -> None:
        """Active and trashed; their note_tag rows go with them (ON DELETE CASCADE)."""
        note_ids = _scoped(NoteScope.ANY).where(Note.user_id == user_id).with_only_columns(Note.id)
        self._session.execute(delete(Note).where(Note.id.in_(note_ids)))

    def _count(self, query: Select[Note]) -> int:
        return self._session.scalar(select(func.count()).select_from(query.subquery())) or 0
