from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import messages
from app.models.folder_model import Folder
from app.models.note_model import Note
from app.models.user_model import User
from tests.factories import make_folder, make_note, make_user
from tests.fakes import FakeClock

FOLDERS = "/api/v1/folders"


def _folder_path(folder: Folder) -> str:
    return f"{FOLDERS}/{folder.uuid}"


def test_folders_need_a_session(client: TestClient) -> None:
    assert client.post(FOLDERS, json={"name": "Work"}).status_code == 401


def test_create_a_top_level_folder(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(FOLDERS, json={"name": "  Work  ", "color": "#ff8800"})

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Work"
    assert data["parent_uuid"] is None
    assert data["color"] == "#ff8800"
    assert data["position"] == 0
    assert set(data) == {"uuid", "name", "parent_uuid", "color", "position"}


def test_create_a_folder_inside_another(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    parent = make_folder(db_session, user, name="Projects")

    response = authenticated_client.post(FOLDERS, json={"name": "Work", "parent_uuid": str(parent.uuid)})

    assert response.json()["data"]["parent_uuid"] == str(parent.uuid)


def test_create_keeps_the_uuid_the_client_chose(authenticated_client: TestClient) -> None:
    chosen = str(uuid4())

    response = authenticated_client.post(FOLDERS, json={"uuid": chosen, "name": "Work"})

    assert response.json()["data"]["uuid"] == chosen


def test_create_again_with_the_same_uuid_returns_the_existing_folder(
    authenticated_client: TestClient,
) -> None:
    chosen = str(uuid4())
    authenticated_client.post(FOLDERS, json={"uuid": chosen, "name": "Work"})

    response = authenticated_client.post(FOLDERS, json={"uuid": chosen, "name": "Work"})

    assert response.status_code == 200
    assert response.json()["data"]["uuid"] == chosen


def test_create_with_another_users_uuid_is_a_conflict(
    authenticated_client: TestClient, db_session: Session
) -> None:
    other = make_folder(db_session, make_user(db_session), name="Theirs")

    response = authenticated_client.post(FOLDERS, json={"uuid": str(other.uuid), "name": "Mine"})

    assert response.status_code == 409


def test_create_in_an_unknown_or_foreign_parent_is_not_found(
    authenticated_client: TestClient, db_session: Session
) -> None:
    foreign = make_folder(db_session, make_user(db_session))

    unknown = authenticated_client.post(FOLDERS, json={"name": "Work", "parent_uuid": str(uuid4())})
    theirs = authenticated_client.post(FOLDERS, json={"name": "Work", "parent_uuid": str(foreign.uuid)})

    assert unknown.status_code == theirs.status_code == 404


def test_create_rejects_a_sibling_name_in_any_case(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_folder(db_session, user, name="Work")

    response = authenticated_client.post(FOLDERS, json={"name": "WORK"})

    assert response.status_code == 409
    assert response.json()["details"] == [{"field": "name", "message": messages.NAME_TAKEN}]


def test_the_same_name_is_fine_in_another_parent(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_folder(db_session, user, name="Work")
    parent = make_folder(db_session, user, name="Projects")

    response = authenticated_client.post(FOLDERS, json={"name": "Work", "parent_uuid": str(parent.uuid)})

    assert response.status_code == 201


def test_another_users_folder_name_is_not_taken(
    authenticated_client: TestClient, db_session: Session
) -> None:
    make_folder(db_session, make_user(db_session), name="Work")

    assert authenticated_client.post(FOLDERS, json={"name": "Work"}).status_code == 201


def test_create_validates_name_and_color(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(FOLDERS, json={"name": " ", "color": "orange"})

    assert response.status_code == 422
    assert {detail["field"] for detail in response.json()["details"]} == {"name", "color"}


def test_create_rejects_a_name_over_120_characters(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(FOLDERS, json={"name": "x" * 121})

    assert response.json()["details"] == [
        {"field": "name", "message": "The name field must not be greater than 120 characters."}
    ]


def test_update_renames_recolours_and_moves_in_the_list(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    folder = make_folder(db_session, user, name="Work")

    response = authenticated_client.patch(
        _folder_path(folder), json={"name": "Office", "color": "#112233", "position": 3}
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["name"], data["color"], data["position"]) == ("Office", "#112233", 3)


def test_update_can_clear_the_colour(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    folder = make_folder(db_session, user, name="Work")
    folder.color = "#112233"
    db_session.flush()

    response = authenticated_client.patch(_folder_path(folder), json={"color": None})

    assert response.json()["data"]["color"] is None
    assert response.json()["data"]["name"] == "Work"


def test_update_rejects_a_siblings_name(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_folder(db_session, user, name="Home")
    folder = make_folder(db_session, user, name="Work")

    response = authenticated_client.patch(_folder_path(folder), json={"name": "home"})

    assert response.status_code == 409


def test_update_may_change_only_the_case_of_its_own_name(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    folder = make_folder(db_session, user, name="work")

    response = authenticated_client.patch(_folder_path(folder), json={"name": "Work"})

    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Work"


def test_another_users_folder_is_not_found(authenticated_client: TestClient, db_session: Session) -> None:
    theirs = make_folder(db_session, make_user(db_session))

    assert authenticated_client.patch(_folder_path(theirs), json={"name": "Mine"}).status_code == 404
    assert authenticated_client.delete(_folder_path(theirs)).status_code == 404


def test_delete_moves_its_notes_to_the_top_level_even_from_trash(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    folder = make_folder(db_session, user, name="Work")
    note = make_note(db_session, user, folder=folder)
    trashed = make_note(db_session, user, folder=folder)
    trashed.deleted_at = clock.now()
    db_session.flush()

    response = authenticated_client.delete(_folder_path(folder))

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.scalars(select(Note.folder_id).where(Note.id.in_([note.id, trashed.id]))).all() == [
        None,
        None,
    ]
    assert db_session.get(Folder, folder.id) is None


def test_delete_moves_child_folders_up_and_renames_clashes(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_folder(db_session, user, name="Ideas")
    make_folder(db_session, user, name="Ideas (2)")
    work = make_folder(db_session, user, name="Work")
    ideas = make_folder(db_session, user, name="ideas", parent=work)
    clients = make_folder(db_session, user, name="Clients", parent=work)
    namesake = make_folder(db_session, user, name="Work", parent=work)

    authenticated_client.delete(_folder_path(work))

    db_session.expire_all()
    assert [(folder.parent_id, folder.name) for folder in (ideas, clients, namesake)] == [
        (None, "ideas (3)"),
        (None, "Clients"),
        (None, "Work"),
    ]


def test_delete_keeps_children_inside_the_grandparent(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    root = make_folder(db_session, user, name="Root")
    middle = make_folder(db_session, user, name="Middle", parent=root)
    child = make_folder(db_session, user, name="Child", parent=middle)

    authenticated_client.delete(_folder_path(middle))

    db_session.refresh(child)
    assert child.parent_id == root.id
