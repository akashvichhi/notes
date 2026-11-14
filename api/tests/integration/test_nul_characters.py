"""Postgres text cannot hold a NUL character, so text input carrying one is rejected
before it reaches the database, and text derived from a note body never keeps one."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.note_model import Note
from app.models.user_model import User
from tests.factories import make_note
from tests.mcp_client import McpClient

NUL = "\x00"
TEXT_WITH_NUL = f"a{NUL}b"
NUL_MESSAGE_ENDING = "must not contain a NUL character."
REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
FOLDERS = "/api/v1/folders"
TAGS = "/api/v1/tags"
NOTES = "/api/v1/notes"
SEARCH = "/api/v1/search"
TOKENS = "/api/v1/me/access-tokens"
PROFILE = "/api/v1/me"
PASSWORD_PATH = "/api/v1/me/password"
GOOD_PASSWORD = "correct horse battery"


def _nul_field(response_json: dict[str, object]) -> str:
    details = response_json["details"]
    assert isinstance(details, list)
    nul_details = [detail for detail in details if str(detail["message"]).endswith(NUL_MESSAGE_ENDING)]
    assert len(nul_details) == 1, details
    return str(nul_details[0]["field"])


@pytest.mark.parametrize("field", ["name", "email", "password"], ids=["name", "email", "password"])
def test_register_rejects_a_nul_character(client: TestClient, field: str) -> None:
    payload = {
        "name": "Asha",
        "email": "asha@example.com",
        "password": GOOD_PASSWORD,
        "password_confirmation": GOOD_PASSWORD,
    }
    payload[field] = TEXT_WITH_NUL + payload[field]
    if field == "password":
        payload["password_confirmation"] = payload["password"]

    response = client.post(REGISTER, json=payload)

    assert response.status_code == 422
    assert _nul_field(response.json()) == field


@pytest.mark.parametrize("field", ["email", "password"])
def test_login_rejects_a_nul_character(client: TestClient, field: str) -> None:
    payload = {"email": "asha@example.com", "password": GOOD_PASSWORD}
    payload[field] = TEXT_WITH_NUL

    response = client.post(LOGIN, json=payload)

    assert response.status_code == 422
    assert _nul_field(response.json()) == field


def test_profile_and_password_changes_reject_a_nul_character(authenticated_client: TestClient) -> None:
    profile = authenticated_client.patch(PROFILE, json={"name": TEXT_WITH_NUL})
    password = authenticated_client.put(
        PASSWORD_PATH,
        json={
            "current_password": TEXT_WITH_NUL,
            "password": GOOD_PASSWORD,
            "password_confirmation": GOOD_PASSWORD,
        },
    )

    assert profile.status_code == password.status_code == 422
    assert _nul_field(profile.json()) == "name"
    assert _nul_field(password.json()) == "current_password"


@pytest.mark.parametrize(
    ("path", "payload", "field"),
    [
        (FOLDERS, {"name": TEXT_WITH_NUL}, "name"),
        (TAGS, {"name": TEXT_WITH_NUL}, "name"),
        (TOKENS, {"name": TEXT_WITH_NUL, "abilities": ["notes:read"]}, "name"),
    ],
    ids=["folder", "tag", "access_token"],
)
def test_names_reject_a_nul_character(
    authenticated_client: TestClient, path: str, payload: dict[str, object], field: str
) -> None:
    response = authenticated_client.post(path, json=payload)

    assert response.status_code == 422
    assert _nul_field(response.json()) == field


def test_note_titles_and_tag_names_reject_a_nul_character(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)

    title = authenticated_client.patch(f"{NOTES}/{note.uuid}", json={"title": TEXT_WITH_NUL})
    tags = authenticated_client.put(f"{NOTES}/{note.uuid}/tags", json={"names": [TEXT_WITH_NUL]})

    assert title.status_code == tags.status_code == 422
    assert _nul_field(title.json()) == "title"
    assert _nul_field(tags.json()) == "names.0"


def test_queries_reject_a_nul_character(authenticated_client: TestClient) -> None:
    search = authenticated_client.get(SEARCH, params={"q": f"milk{NUL}"})
    tag_filter = authenticated_client.get(NOTES, params={"tag": TEXT_WITH_NUL})

    assert search.status_code == tag_filter.status_code == 422
    assert _nul_field(search.json()) == "q"
    assert _nul_field(tag_filter.json()) == "tag"


def test_a_body_with_a_nul_character_saves_and_its_derived_text_drops_it(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    note = make_note(db_session, user)
    paragraph = {"type": "paragraph", "content": [{"type": "text", "text": f"eggs{NUL}milk"}]}
    body = {"type": "doc", "content": [paragraph]}

    response = authenticated_client.patch(f"{NOTES}/{note.uuid}", json={"body": body, "version": 1})

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["body"] == body
    assert (data["title"], data["excerpt"]) == ("eggsmilk", "eggsmilk")
    db_session.expire_all()
    assert db_session.scalar(select(Note.plain_text).where(Note.id == note.id)) == "eggsmilk"


def test_mcp_tools_reject_a_nul_character(mcp: McpClient, db_session: Session, user: User) -> None:
    mcp.error("create_note", title=TEXT_WITH_NUL)
    mcp.error("list_notes", tag=TEXT_WITH_NUL)

    assert db_session.scalar(select(Note).where(Note.user_id == user.id)) is None
