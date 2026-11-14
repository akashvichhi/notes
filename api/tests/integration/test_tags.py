from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants import messages
from app.models.note_model import Note, note_tag
from app.models.tag_model import Tag
from app.models.user_model import User
from tests.factories import make_note, make_tag, make_user

TAGS = "/api/v1/tags"


def _tag_path(tag: Tag) -> str:
    return f"{TAGS}/{tag.uuid}"


def test_tags_need_a_session(client: TestClient) -> None:
    assert client.post(TAGS, json={"name": "work"}).status_code == 401


def test_create_trims_the_name_and_derives_the_slug(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(TAGS, json={"name": "  Side Projects  "})

    assert response.status_code == 201
    data = response.json()["data"]
    assert (data["name"], data["slug"]) == ("Side Projects", "side-projects")
    assert set(data) == {"uuid", "name", "slug"}


def test_create_keeps_the_uuid_the_client_chose(authenticated_client: TestClient) -> None:
    chosen = str(uuid4())

    response = authenticated_client.post(TAGS, json={"uuid": chosen, "name": "work"})

    assert response.json()["data"]["uuid"] == chosen


def test_create_again_with_the_same_uuid_returns_the_existing_tag(authenticated_client: TestClient) -> None:
    chosen = str(uuid4())
    authenticated_client.post(TAGS, json={"uuid": chosen, "name": "work"})

    response = authenticated_client.post(TAGS, json={"uuid": chosen, "name": "work"})

    assert response.status_code == 200
    assert response.json()["data"]["uuid"] == chosen


def test_create_with_another_users_uuid_is_a_conflict(
    authenticated_client: TestClient, db_session: Session
) -> None:
    theirs = make_tag(db_session, make_user(db_session))

    response = authenticated_client.post(TAGS, json={"uuid": str(theirs.uuid), "name": "mine"})

    assert response.status_code == 409


def test_create_rejects_a_name_with_the_same_slug(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_tag(db_session, user, name="Side Projects", slug="side-projects")

    response = authenticated_client.post(TAGS, json={"name": "side_projects"})

    assert response.status_code == 409
    assert response.json()["details"] == [{"field": "name", "message": messages.NAME_TAKEN}]


def test_another_users_tag_name_is_not_taken(authenticated_client: TestClient, db_session: Session) -> None:
    make_tag(db_session, make_user(db_session), name="work", slug="work")

    assert authenticated_client.post(TAGS, json={"name": "work"}).status_code == 201


def test_create_rejects_a_blank_name(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(TAGS, json={"name": "   "})

    assert response.status_code == 422
    assert response.json()["details"][0]["field"] == "name"


def test_create_rejects_a_name_over_60_characters(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(TAGS, json={"name": "x" * 61})

    assert response.json()["details"] == [{"field": "name", "message": "Name must be at most 60 characters."}]


def test_create_rejects_a_name_that_has_no_slug(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(TAGS, json={"name": "日本語"})

    assert response.status_code == 422
    assert response.json()["details"] == [{"field": "name", "message": messages.TAG_NAME_WITHOUT_SLUG}]


def test_rename_changes_the_name_and_the_slug(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    tag = make_tag(db_session, user, name="work", slug="work")

    response = authenticated_client.patch(_tag_path(tag), json={"name": "Office Work"})

    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["uuid"], data["name"], data["slug"]) == (str(tag.uuid), "Office Work", "office-work")


def test_rename_rejects_another_tags_slug(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_tag(db_session, user, name="home", slug="home")
    tag = make_tag(db_session, user, name="work", slug="work")

    response = authenticated_client.patch(_tag_path(tag), json={"name": "Home"})

    assert response.status_code == 409


def test_rename_may_change_only_the_case(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    tag = make_tag(db_session, user, name="work", slug="work")

    response = authenticated_client.patch(_tag_path(tag), json={"name": "Work"})

    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Work"


def test_rename_needs_a_name(authenticated_client: TestClient, db_session: Session, user: User) -> None:
    tag = make_tag(db_session, user)

    response = authenticated_client.patch(_tag_path(tag), json={})

    assert response.status_code == 422
    assert response.json()["details"][0]["field"] == "name"


def test_another_users_tag_is_not_found(authenticated_client: TestClient, db_session: Session) -> None:
    theirs = make_tag(db_session, make_user(db_session))

    assert authenticated_client.patch(_tag_path(theirs), json={"name": "mine"}).status_code == 404
    assert authenticated_client.delete(_tag_path(theirs)).status_code == 404


def test_delete_removes_the_tag_from_its_notes_and_keeps_the_notes(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    tag = make_tag(db_session, user)
    note = make_note(db_session, user)
    db_session.execute(note_tag.insert().values(note_id=note.id, tag_id=tag.id))

    response = authenticated_client.delete(_tag_path(tag))

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(Tag, tag.id) is None
    assert db_session.get(Note, note.id) is not None
    assert db_session.scalar(select(func.count()).select_from(note_tag)) == 0
