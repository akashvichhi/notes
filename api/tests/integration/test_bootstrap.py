from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.note_model import note_tag
from app.models.user_model import User
from tests.factories import make_folder, make_note, make_tag, make_user
from tests.fakes import FakeClock

BOOTSTRAP = "/api/v1/bootstrap"
BOOTSTRAP_NOTES_MAX = 50


def test_bootstrap_needs_a_session(client: TestClient) -> None:
    assert client.get(BOOTSTRAP).status_code == 401


def test_bootstrap_of_a_new_account(authenticated_client: TestClient, user: User) -> None:
    response = authenticated_client.get(BOOTSTRAP)

    assert response.status_code == 200
    data = response.json()["data"]
    assert set(data) == {"user", "folders", "tags", "counts", "notes"}
    assert data["user"]["uuid"] == str(user.uuid)
    assert (data["folders"], data["tags"], data["notes"]) == ([], [], [])
    assert data["counts"] == {"all": 0, "starred": 0, "trashed": 0, "folders": [], "tags": []}


def test_bootstrap_lists_folders_by_position_then_name_and_tags_by_name(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    parent = make_folder(db_session, user, name="Work", position=1)
    child = make_folder(db_session, user, name="Releases", parent=parent, position=0)
    make_folder(db_session, user, name="Archive", position=1)
    make_folder(db_session, make_user(db_session), name="Theirs")
    make_tag(db_session, user, name="todo", slug="todo")
    make_tag(db_session, user, name="Draft", slug="draft")

    data = authenticated_client.get(BOOTSTRAP).json()["data"]

    assert [folder["name"] for folder in data["folders"]] == ["Releases", "Archive", "Work"]
    assert data["folders"][0]["parent_uuid"] == str(parent.uuid)
    assert data["folders"][0]["uuid"] == str(child.uuid)
    assert [tag["name"] for tag in data["tags"]] == ["Draft", "todo"]


def test_bootstrap_counts_active_notes_per_folder_and_tag(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    work = make_folder(db_session, user, name="Work")
    empty = make_folder(db_session, user, name="Empty")
    todo = make_tag(db_session, user, name="todo", slug="todo")
    make_tag(db_session, user, name="unused", slug="unused")
    first = make_note(db_session, user, folder=work)
    second = make_note(db_session, user, folder=work)
    make_note(db_session, user)
    trashed = make_note(db_session, user, folder=work)
    make_note(db_session, make_user(db_session))
    first.is_starred = True
    trashed.is_starred = True
    trashed.deleted_at = clock.now()
    for note in (first, second, trashed):
        db_session.execute(note_tag.insert().values(note_id=note.id, tag_id=todo.id))
    db_session.flush()

    counts = authenticated_client.get(BOOTSTRAP).json()["data"]["counts"]

    assert (counts["all"], counts["starred"], counts["trashed"]) == (3, 1, 1)
    assert counts["folders"] == [
        {"uuid": str(empty.uuid), "count": 0},
        {"uuid": str(work.uuid), "count": 2},
    ]
    assert counts["tags"] == [{"slug": "todo", "count": 2}, {"slug": "unused", "count": 0}]


def test_bootstrap_sends_the_newest_fifty_active_notes(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    notes = [make_note(db_session, user, title=f"Note {number}") for number in range(BOOTSTRAP_NOTES_MAX + 1)]
    for age, note in enumerate(notes):
        note.updated_at = clock.now() - timedelta(minutes=age)
    trashed = make_note(db_session, user, title="Trashed")
    trashed.deleted_at = clock.now()
    db_session.flush()

    data = authenticated_client.get(BOOTSTRAP).json()["data"]

    assert [note["title"] for note in data["notes"]] == [f"Note {n}" for n in range(BOOTSTRAP_NOTES_MAX)]
    assert "body" not in data["notes"][0]
