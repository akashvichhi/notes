from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.content.demo_content import DemoContent, DemoNote
from app.content.markdown_to_document import markdown_to_document
from app.core.security import PasswordHasher, hash_token
from app.models.access_token_model import AccessToken
from app.models.folder_model import Folder
from app.models.note_model import Note
from app.models.tag_model import Tag
from app.models.user_model import User
from app.models.user_session_model import UserSession
from app.repositories.access_token_repository import AccessTokenRepository
from app.repositories.folder_repository import FolderRepository
from app.repositories.note_repository import NoteRepository
from app.repositories.tag_repository import TagRepository
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.services.demo_reset_service import DemoAccount, DemoResetResult, DemoResetService
from app.services.tag_service import TagService
from tests.factories import make_access_token, make_folder, make_note, make_tag, make_user, tag_note
from tests.fakes import START_TIME

DEMO = DemoAccount(email="demo@example.com", password="Demo@2026", name="Demo")
CONTENT = DemoContent(
    folders=("Ideas", "Work"),
    notes=(
        DemoNote(
            body=markdown_to_document("# Launch plan\n\nShip the beta on Friday."),
            folder="Work",
            tags=("Planning", "Launch"),
            starred=True,
        ),
        DemoNote(
            body=markdown_to_document("A loose thought"), folder=None, tags=("Planning",), starred=False
        ),
    ),
)


class FailingNoteRepository(NoteRepository):
    """Fails while the sample notes are written, after the old content is gone."""

    def add(self, note: Note) -> Note:
        raise RuntimeError


def _service(db_session: Session, notes: NoteRepository | None = None) -> DemoResetService:
    tags = TagRepository(db_session)
    return DemoResetService(
        db_session,
        UserRepository(db_session),
        UserSessionRepository(db_session),
        AccessTokenRepository(db_session),
        notes or NoteRepository(db_session),
        FolderRepository(db_session),
        tags,
        TagService(db_session, tags),
        PasswordHasher(),
        CONTENT,
    )


def _demo_user(db_session: Session) -> User:
    user = db_session.scalar(select(User).where(User.email == DEMO.email))
    assert user is not None
    return user


def _add_session(db_session: Session, user: User, name: str) -> None:
    UserSessionRepository(db_session).add(user.id, hash_token(name), START_TIME + timedelta(days=1))


def _notes_of(db_session: Session, user: User) -> list[Note]:
    """Every note of the user, the Trash included."""
    return list(db_session.scalars(select(Note).where(Note.user_id == user.id).order_by(Note.id)))


def _count(
    db_session: Session, model: type[Folder | Tag | Note | AccessToken | UserSession], user: User
) -> int:
    return db_session.scalar(select(func.count()).select_from(model).where(model.user_id == user.id)) or 0


def test_reset_creates_the_demo_account_when_it_is_missing(db_session: Session) -> None:
    result = _service(db_session).reset(DEMO)

    user = _demo_user(db_session)
    assert result.created
    assert result.user_id == user.id
    assert user.name == DEMO.name
    assert PasswordHasher().verify(user.password_hash, DEMO.password)


def test_reset_restores_the_name_and_password_of_an_existing_account(db_session: Session) -> None:
    existing = make_user(db_session, email=DEMO.email, name="Renamed by a visitor")

    result = _service(db_session).reset(DEMO)

    user = _demo_user(db_session)
    assert not result.created
    assert user.id == existing.id
    assert user.name == DEMO.name
    assert PasswordHasher().verify(user.password_hash, DEMO.password)


def test_reset_replaces_changed_and_deleted_content_with_the_sample_set(db_session: Session) -> None:
    user = make_user(db_session, email=DEMO.email)
    # A sample folder the visitor kept, so a reset that forgot to clear it would clash.
    work = make_folder(db_session, user, name="Work")
    make_folder(db_session, user, name="Visitor folder", parent=work)
    visitor_tag = make_tag(db_session, user, name="visitor")
    tag_note(db_session, make_note(db_session, user, title="Visitor note", folder=work), visitor_tag)
    make_note(db_session, user, title="Trashed note").deleted_at = START_TIME

    result = _service(db_session).reset(DEMO)

    folders = db_session.scalars(
        select(Folder).where(Folder.user_id == user.id).order_by(Folder.position)
    ).all()
    assert [(folder.name, folder.parent_id) for folder in folders] == [("Ideas", None), ("Work", None)]
    tags = db_session.scalars(select(Tag.slug).where(Tag.user_id == user.id).order_by(Tag.slug)).all()
    assert tags == ["launch", "planning"]
    notes = _notes_of(db_session, user)
    assert sorted(note.title for note in notes) == ["A loose thought", "Launch plan"]
    assert all(note.deleted_at is None for note in notes)
    assert result == DemoResetResult(user_id=user.id, created=False, folders=2, tags=2, notes=2)


def test_reset_stores_each_sample_note_like_a_note_written_in_the_editor(db_session: Session) -> None:
    _service(db_session).reset(DEMO)

    user = _demo_user(db_session)
    note = db_session.scalar(select(Note).where(Note.user_id == user.id, Note.title == "Launch plan"))
    assert note is not None
    assert note.body == CONTENT.notes[0].body
    assert note.plain_text == "Launch plan Ship the beta on Friday."
    assert note.word_count == 7
    assert not note.title_locked
    assert note.is_starred
    work = db_session.scalar(select(Folder).where(Folder.id == note.folder_id))
    assert work is not None
    assert work.name == "Work"
    loaded = NoteRepository(db_session).load(note.id)
    assert [tag.slug for tag in loaded.tags] == ["launch", "planning"]


def test_reset_removes_access_tokens_and_ends_sessions(db_session: Session) -> None:
    user = make_user(db_session, email=DEMO.email)
    make_access_token(db_session, user)
    _add_session(db_session, user, "visitor")

    _service(db_session).reset(DEMO)

    assert _count(db_session, AccessToken, user) == 0
    assert _count(db_session, UserSession, user) == 0


def test_reset_leaves_other_users_data_untouched(db_session: Session) -> None:
    make_user(db_session, email=DEMO.email)
    other = make_user(db_session)
    folder = make_folder(db_session, other, name="Work")
    tag_note(
        db_session, make_note(db_session, other, title="Mine", folder=folder), make_tag(db_session, other)
    )
    make_note(db_session, other, title="In my trash").deleted_at = START_TIME
    make_access_token(db_session, other)
    _add_session(db_session, other, "other")
    name, password_hash = other.name, other.password_hash

    _service(db_session).reset(DEMO)

    counts = [_count(db_session, model, other) for model in (Folder, Tag, Note, AccessToken, UserSession)]
    assert counts == [1, 1, 2, 1, 1]
    assert (other.name, other.password_hash) == (name, password_hash)


def test_failed_reset_keeps_the_old_demo_content(db_session: Session) -> None:
    user = make_user(db_session, email=DEMO.email, name="Before")
    make_note(db_session, user, title="Old note")
    make_access_token(db_session, user)
    # Committed (a savepoint here), so the reset's rollback undoes only its own changes.
    db_session.commit()

    with pytest.raises(RuntimeError):
        _service(db_session, notes=FailingNoteRepository(db_session)).reset(DEMO)

    db_session.expire_all()
    assert [note.title for note in _notes_of(db_session, user)] == ["Old note"]
    assert _count(db_session, AccessToken, user) == 1
    assert _demo_user(db_session).name == "Before"
