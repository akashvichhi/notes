"""The guarantees the schema itself gives, whatever the services do."""

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.note_model import Note
from app.models.user_model import User
from app.schemas.common.json_types import JsonObject
from tests.factories import make_folder, make_note, make_tag, make_user


def test_email_is_unique_whatever_its_case(db_session: Session) -> None:
    make_user(db_session, email="Asha@Example.com")

    with pytest.raises(IntegrityError):
        make_user(db_session, email="asha@example.COM")


def test_email_lookup_ignores_case(db_session: Session) -> None:
    user = make_user(db_session, email="Asha@Example.com")

    found = db_session.scalar(select(User).where(User.email == "asha@example.com"))

    assert found is not None
    assert found.id == user.id


def test_folder_names_clash_whatever_their_case_and_accents(db_session: Session) -> None:
    user = make_user(db_session)
    make_folder(db_session, user, name="Café")

    with pytest.raises(IntegrityError):
        make_folder(db_session, user, name="CAFE")


def test_two_root_folders_cannot_share_a_name(db_session: Session) -> None:
    user = make_user(db_session)
    make_folder(db_session, user, name="Work")

    with pytest.raises(IntegrityError):
        make_folder(db_session, user, name="Work")


def test_the_same_folder_name_is_fine_under_different_parents(db_session: Session) -> None:
    user = make_user(db_session)
    parent = make_folder(db_session, user, name="Projects")

    make_folder(db_session, user, name="Work")
    make_folder(db_session, user, name="Work", parent=parent)


def test_tag_slugs_are_unique_per_user(db_session: Session) -> None:
    user = make_user(db_session)
    make_tag(db_session, user, name="Ideas", slug="ideas")

    with pytest.raises(IntegrityError):
        make_tag(db_session, user, name="IDEAS", slug="IDEAS")


def test_two_users_can_have_the_same_tag(db_session: Session) -> None:
    make_tag(db_session, make_user(db_session), name="ideas")
    make_tag(db_session, make_user(db_session), name="ideas")


def test_search_vector_follows_the_title_and_text(db_session: Session) -> None:
    user = make_user(db_session)
    note = make_note(db_session, user, title="Shopping", plain_text="Buy oranges")

    matches = db_session.scalars(
        select(Note.id).where(Note.search_vector.bool_op("@@")(func.to_tsquery("simple", "shop:* & orang:*")))
    ).all()

    assert matches == [note.id]


def test_body_keys_come_back_in_the_order_they_were_saved(db_session: Session) -> None:
    body: JsonObject = {"content": [{"type": "paragraph", "attrs": {"textAlign": "center"}}], "type": "doc"}
    note = make_note(db_session, make_user(db_session), body=body)
    db_session.expire(note)

    assert list(note.body.keys()) == ["content", "type"]


def test_new_notes_get_an_empty_document_and_version_one(db_session: Session) -> None:
    note = Note(user_id=make_user(db_session).id)
    db_session.add(note)
    db_session.flush()
    db_session.refresh(note)

    assert note.body == {"type": "doc", "content": []}
    assert note.version == 1
    assert note.uuid is not None
