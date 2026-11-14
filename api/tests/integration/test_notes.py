from datetime import timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import messages
from app.models.note_model import Note, note_tag
from app.models.tag_model import Tag
from app.models.user_model import User
from app.schemas.common.json_types import JsonObject
from tests.factories import make_folder, make_note, make_tag, make_user
from tests.fakes import FakeClock

NOTES = "/api/v1/notes"
TRASH = "/api/v1/trash"
NOTE_SAVES_PER_MINUTE = 240
LIST_FIELDS = {"uuid", "title", "excerpt", "is_starred", "folder", "tags", "updated_at", "deleted_at"}
FULL_FIELDS = LIST_FIELDS | {"body", "version", "word_count", "title_locked"}


def _note_path(note: Note, suffix: str = "") -> str:
    return f"{NOTES}/{note.uuid}{suffix}"


def _doc(*paragraphs: str) -> JsonObject:
    return {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": text}]} for text in paragraphs
        ],
    }


def _trash(note: Note, clock: FakeClock, db_session: Session) -> None:
    note.deleted_at = clock.now()
    db_session.flush()


def _tag(db_session: Session, note: Note, tag: Tag) -> None:
    db_session.execute(note_tag.insert().values(note_id=note.id, tag_id=tag.id))


def test_notes_need_a_session(client: TestClient) -> None:
    assert client.get(NOTES).status_code == 401
    assert client.post(NOTES, json={}).status_code == 401
    assert client.delete(TRASH).status_code == 401


# Create


def test_create_makes_an_empty_note(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(NOTES, json={})

    assert response.status_code == 201
    data = response.json()["data"]
    assert set(data) == FULL_FIELDS
    assert data["body"] == {"type": "doc", "content": []}
    assert (data["title"], data["version"], data["word_count"], data["title_locked"]) == ("", 1, 0, False)
    assert (data["folder"], data["tags"], data["deleted_at"]) == (None, [], None)
    assert data["updated_at"].endswith("+05:30")


def test_create_in_a_folder(authenticated_client: TestClient, db_session: Session, user: User) -> None:
    folder = make_folder(db_session, user, name="Work")

    response = authenticated_client.post(NOTES, json={"folder_id": str(folder.uuid)})

    assert response.json()["data"]["folder"] == {"uuid": str(folder.uuid), "name": "Work"}


def test_create_in_an_unknown_or_foreign_folder_is_not_found(
    authenticated_client: TestClient, db_session: Session
) -> None:
    theirs = make_folder(db_session, make_user(db_session))

    unknown = authenticated_client.post(NOTES, json={"folder_id": str(uuid4())})
    foreign = authenticated_client.post(NOTES, json={"folder_id": str(theirs.uuid)})

    assert unknown.status_code == foreign.status_code == 404


def test_create_again_with_the_same_uuid_returns_the_existing_note(authenticated_client: TestClient) -> None:
    chosen = str(uuid4())
    authenticated_client.post(NOTES, json={"uuid": chosen})

    response = authenticated_client.post(NOTES, json={"uuid": chosen})

    assert response.status_code == 200
    assert response.json()["data"]["uuid"] == chosen


def test_create_with_another_users_uuid_is_a_conflict(
    authenticated_client: TestClient, db_session: Session
) -> None:
    theirs = make_note(db_session, make_user(db_session))

    assert authenticated_client.post(NOTES, json={"uuid": str(theirs.uuid)}).status_code == 409


# Show


def test_show_returns_the_body_exactly_as_stored(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    body: JsonObject = {"content": [{"type": "paragraph", "attrs": {"textAlign": None}}], "type": "doc"}
    note = make_note(db_session, user, body=body)

    response = authenticated_client.get(_note_path(note))

    assert response.status_code == 200
    returned = response.json()["data"]["body"]
    assert returned == body
    assert list(returned) == ["content", "type"]


def test_show_finds_a_note_in_the_trash(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    note = make_note(db_session, user)
    _trash(note, clock, db_session)

    response = authenticated_client.get(_note_path(note))

    assert response.status_code == 200
    assert response.json()["data"]["deleted_at"] is not None


def test_another_users_note_is_not_found_everywhere(
    authenticated_client: TestClient, db_session: Session
) -> None:
    theirs = make_note(db_session, make_user(db_session))

    assert authenticated_client.get(_note_path(theirs)).status_code == 404
    assert authenticated_client.patch(_note_path(theirs), json={"is_starred": True}).status_code == 404
    assert authenticated_client.delete(_note_path(theirs)).status_code == 404
    assert authenticated_client.post(_note_path(theirs, "/restore"), json={}).status_code == 404
    assert authenticated_client.post(_note_path(theirs, "/duplicate")).status_code == 404
    assert authenticated_client.put(_note_path(theirs, "/tags"), json={"names": []}).status_code == 404


# List


def test_list_returns_active_notes_newest_edit_first_without_bodies(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    older = make_note(db_session, user, title="Older")
    newer = make_note(db_session, user, title="Newer")
    trashed = make_note(db_session, user, title="Trashed")
    make_note(db_session, make_user(db_session), title="Not mine")
    older.updated_at = clock.now() - timedelta(days=2)
    newer.updated_at = clock.now() - timedelta(days=1)
    _trash(trashed, clock, db_session)

    response = authenticated_client.get(NOTES)

    assert response.status_code == 200
    data = response.json()["data"]
    assert [note["title"] for note in data] == ["Newer", "Older"]
    assert set(data[0]) == LIST_FIELDS
    assert response.json()["meta"] == {"total_count": 2, "current_page": 1, "per_page": 20, "total_pages": 1}


def test_list_the_trash(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    make_note(db_session, user, title="Active")
    trashed = make_note(db_session, user, title="Trashed")
    _trash(trashed, clock, db_session)

    response = authenticated_client.get(NOTES, params={"trashed": "true"})

    assert [note["title"] for note in response.json()["data"]] == ["Trashed"]


def test_list_filters_by_folder_tag_and_star(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    folder = make_folder(db_session, user)
    tag = make_tag(db_session, user, name="Work", slug="work")
    in_folder = make_note(db_session, user, title="In folder", folder=folder)
    tagged = make_note(db_session, user, title="Tagged")
    starred = make_note(db_session, user, title="Starred")
    _tag(db_session, tagged, tag)
    starred.is_starred = True
    db_session.flush()

    by_folder = authenticated_client.get(NOTES, params={"folder_id": str(folder.uuid)})
    by_tag = authenticated_client.get(NOTES, params={"tag": "work"})
    by_star = authenticated_client.get(NOTES, params={"starred": "true"})

    assert [note["uuid"] for note in by_folder.json()["data"]] == [str(in_folder.uuid)]
    assert [note["uuid"] for note in by_tag.json()["data"]] == [str(tagged.uuid)]
    assert by_tag.json()["data"][0]["tags"] == ["work"]
    assert [note["uuid"] for note in by_star.json()["data"]] == [str(starred.uuid)]


def test_list_in_an_unknown_folder_is_not_found(authenticated_client: TestClient) -> None:
    assert authenticated_client.get(NOTES, params={"folder_id": str(uuid4())}).status_code == 404


def test_list_sorts_by_title_or_by_creation(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    banana = make_note(db_session, user, title="banana")
    apple = make_note(db_session, user, title="Apple")
    banana.created_at = clock.now() - timedelta(days=1)
    apple.created_at = clock.now() - timedelta(days=2)
    db_session.flush()

    by_title = authenticated_client.get(NOTES, params={"sort": "title"})
    by_creation = authenticated_client.get(NOTES, params={"sort": "created"})

    assert [note["title"] for note in by_title.json()["data"]] == ["Apple", "banana"]
    assert [note["title"] for note in by_creation.json()["data"]] == ["banana", "Apple"]


def test_list_pages(authenticated_client: TestClient, db_session: Session, user: User) -> None:
    for _ in range(3):
        make_note(db_session, user)

    response = authenticated_client.get(NOTES, params={"page": 2, "per_page": 2})

    assert len(response.json()["data"]) == 1
    assert response.json()["meta"] == {"total_count": 3, "current_page": 2, "per_page": 2, "total_pages": 2}


def test_list_rejects_unknown_sorts_and_oversized_pages(authenticated_client: TestClient) -> None:
    response = authenticated_client.get(NOTES, params={"sort": "colour", "per_page": 101})

    assert response.status_code == 422
    assert {detail["field"] for detail in response.json()["details"]} == {"sort", "per_page"}


# Update


def test_saving_the_body_derives_the_text_and_bumps_the_version(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    response = authenticated_client.patch(
        _note_path(note), json={"body": _doc("Shopping list", "eggs and milk"), "version": 1}
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["version"], data["title"], data["word_count"]) == (2, "Shopping list", 5)
    assert data["excerpt"] == "Shopping list eggs and milk"
    db_session.expire_all()
    assert (
        db_session.scalar(select(Note.plain_text).where(Note.id == note.id)) == "Shopping list eggs and milk"
    )


def test_saving_the_body_needs_the_version(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    response = authenticated_client.patch(_note_path(note), json={"body": _doc("text")})

    assert response.status_code == 422
    assert response.json()["details"][0]["field"] == "version"


def test_a_stale_version_is_a_conflict_with_the_server_copy(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)
    authenticated_client.patch(_note_path(note), json={"body": _doc("first tab"), "version": 1})

    response = authenticated_client.patch(_note_path(note), json={"body": _doc("second tab"), "version": 1})

    assert response.status_code == 409
    payload = response.json()
    assert payload["error"] == messages.NOTE_CHANGED_ELSEWHERE
    assert payload["server_copy"]["version"] == 2
    assert payload["server_copy"]["body"] == _doc("first tab")
    assert set(payload["server_copy"]) == FULL_FIELDS


def test_saving_the_body_of_a_trashed_note_is_a_conflict(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    note = make_note(db_session, user)
    _trash(note, clock, db_session)

    response = authenticated_client.patch(_note_path(note), json={"body": _doc("late save"), "version": 1})

    assert response.status_code == 409


def test_a_title_the_user_sets_stays_when_the_body_changes(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    renamed = authenticated_client.patch(_note_path(note), json={"title": "  My title  "})
    saved = authenticated_client.patch(_note_path(note), json={"body": _doc("First line"), "version": 1})

    assert (renamed.json()["data"]["title"], renamed.json()["data"]["title_locked"]) == ("My title", True)
    assert saved.json()["data"]["title"] == "My title"


def test_a_title_cannot_be_blank_or_too_long(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    blank = authenticated_client.patch(_note_path(note), json={"title": "  "})
    long = authenticated_client.patch(_note_path(note), json={"title": "x" * 256})

    assert blank.status_code == long.status_code == 422


def test_metadata_changes_never_need_the_version(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    folder = make_folder(db_session, user, name="Work")
    note = make_note(db_session, user)

    moved = authenticated_client.patch(
        _note_path(note), json={"folder_id": str(folder.uuid), "is_starred": True}
    )
    back = authenticated_client.patch(_note_path(note), json={"folder_id": None})

    assert moved.json()["data"]["folder"] == {"uuid": str(folder.uuid), "name": "Work"}
    assert moved.json()["data"]["is_starred"] is True
    assert back.json()["data"]["folder"] is None
    assert back.json()["data"]["version"] == 1


def test_moving_to_an_unknown_folder_is_not_found(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    assert authenticated_client.patch(_note_path(note), json={"folder_id": str(uuid4())}).status_code == 404


def test_the_body_must_be_a_document_object(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    response = authenticated_client.patch(_note_path(note), json={"body": "text", "version": 1})

    assert response.status_code == 422
    assert response.json()["details"][0]["field"] == "body"


def test_a_body_nested_too_deeply_is_rejected(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)
    body: JsonObject = {"type": "paragraph"}
    for _ in range(101):
        body = {"type": "blockquote", "content": [body]}

    response = authenticated_client.patch(_note_path(note), json={"body": body, "version": 1})

    assert response.status_code == 422
    assert response.json()["details"] == [{"field": "body", "message": messages.NOTE_TOO_DEEP}]


def test_a_body_too_large_is_rejected(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    response = authenticated_client.patch(
        _note_path(note), json={"body": _doc("x" * 2_000_000), "version": 1}
    )

    assert response.status_code == 422
    assert response.json()["details"] == [{"field": "body", "message": messages.NOTE_TOO_LARGE}]


def test_saves_are_rate_limited_per_user(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)
    for _ in range(NOTE_SAVES_PER_MINUTE):
        authenticated_client.patch(_note_path(note), json={"is_starred": True})

    response = authenticated_client.patch(_note_path(note), json={"is_starred": False})

    assert response.status_code == 429
    assert "Retry-After" in response.headers


# Duplicate


def test_duplicate_copies_the_note_its_tags_and_names_the_copy(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    folder = make_folder(db_session, user, name="Work")
    note = make_note(db_session, user, title="Plan", body=_doc("Plan"), folder=folder)
    note.version = 7
    _tag(db_session, note, make_tag(db_session, user, name="work", slug="work"))
    db_session.flush()

    response = authenticated_client.post(_note_path(note, "/duplicate"))

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["uuid"] != str(note.uuid)
    assert (data["title"], data["title_locked"], data["version"]) == ("Plan (copy)", True, 1)
    assert (data["body"], data["tags"], data["folder"]["name"]) == (_doc("Plan"), ["work"], "Work")


def test_a_copy_of_an_untitled_note_stays_untitled(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    data = authenticated_client.post(_note_path(note, "/duplicate")).json()["data"]

    assert (data["title"], data["title_locked"]) == ("", False)


# Tags


def test_set_tags_replaces_the_set_and_creates_missing_tags(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)
    existing = make_tag(db_session, user, name="Side projects", slug="side-projects")
    _tag(db_session, note, make_tag(db_session, user, name="old", slug="old"))

    response = authenticated_client.put(
        _note_path(note, "/tags"), json={"names": ["Work", " work ", "side_projects", "日本語", ""]}
    )

    assert response.status_code == 200
    assert response.json()["data"]["tags"] == ["side-projects", "work"]
    db_session.expire_all()
    names = db_session.scalars(select(Tag.name).where(Tag.user_id == user.id).order_by(Tag.slug)).all()
    assert names == ["old", "Side projects", "Work"]
    assert db_session.get(Tag, existing.id) is not None


def test_set_tags_validates_the_names(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    missing = authenticated_client.put(_note_path(note, "/tags"), json={})
    too_many = authenticated_client.put(
        _note_path(note, "/tags"), json={"names": [f"t{i}" for i in range(51)]}
    )
    too_long = authenticated_client.put(_note_path(note, "/tags"), json={"names": ["x" * 61]})

    assert missing.status_code == too_many.status_code == too_long.status_code == 422


# Trash


def test_delete_moves_the_note_to_the_trash(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    response = authenticated_client.delete(_note_path(note))

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.scalar(select(Note.deleted_at).where(Note.id == note.id)) is not None


def test_delete_with_force_removes_the_note(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    response = authenticated_client.delete(_note_path(note), params={"force": "true"})

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(Note, note.id) is None


def test_restore_takes_a_note_out_of_the_trash(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    note = make_note(db_session, user)
    _trash(note, clock, db_session)

    response = authenticated_client.post(_note_path(note, "/restore"), json={})

    assert response.status_code == 200
    assert response.json()["data"]["deleted_at"] is None


def test_restore_into_a_folder(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    folder = make_folder(db_session, user, name="Work")
    note = make_note(db_session, user)
    _trash(note, clock, db_session)

    unknown = authenticated_client.post(_note_path(note, "/restore"), json={"folder_id": str(uuid4())})
    restored = authenticated_client.post(_note_path(note, "/restore"), json={"folder_id": str(folder.uuid)})

    assert unknown.status_code == 404
    assert restored.json()["data"]["folder"] == {"uuid": str(folder.uuid), "name": "Work"}


def test_empty_trash_removes_only_your_trashed_notes(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    active = make_note(db_session, user)
    trashed = make_note(db_session, user)
    theirs = make_note(db_session, make_user(db_session))
    _trash(trashed, clock, db_session)
    _trash(theirs, clock, db_session)

    response = authenticated_client.delete(TRASH)

    assert response.status_code == 204
    db_session.expire_all()
    remaining = set(db_session.scalars(select(Note.id)).all())
    assert remaining == {active.id, theirs.id}
