from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.access_token_model import AccessToken
from app.models.user_model import User
from tests.factories import make_note, make_user
from tests.fakes import START_TIME, FakeClock
from tests.mcp_client import READ, McpClient, issue_token

REQUESTS_PER_MINUTE = 120
TOOL_NAMES = {
    "search_notes",
    "list_notes",
    "get_note",
    "list_folders",
    "list_tags",
    "create_note",
    "update_note",
    "move_note",
    "set_note_starred",
    "duplicate_note",
    "set_note_tags",
    "add_note_tags",
    "remove_note_tags",
    "create_folder",
    "rename_folder",
    "set_folder_color",
    "reorder_folder",
    "create_tag",
    "rename_tag",
}


def test_a_request_without_a_token_is_unauthenticated(client: TestClient) -> None:
    response = McpClient(client, None).post("tools/list")

    assert response.status_code == 401
    assert response.json() == {"error": "Unauthenticated."}
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_an_unknown_or_malformed_token_is_unauthenticated(client: TestClient) -> None:
    for token in ("1|notes_pat_wrong", "garbage", "x|y", "|"):
        assert McpClient(client, token).post("tools/list").status_code == 401


def test_a_token_with_the_wrong_secret_is_unauthenticated(
    client: TestClient, db_session: Session, user: User
) -> None:
    token_id = issue_token(db_session, user).split("|", 1)[0]

    assert McpClient(client, f"{token_id}|notes_pat_wrong").post("tools/list").status_code == 401


def test_an_expired_token_is_unauthenticated(client: TestClient, db_session: Session, user: User) -> None:
    token = issue_token(db_session, user, expires_at=START_TIME - timedelta(seconds=1))

    assert McpClient(client, token).post("tools/list").status_code == 401


def test_a_token_without_a_notes_ability_is_forbidden(
    client: TestClient, db_session: Session, user: User
) -> None:
    response = McpClient(client, issue_token(db_session, user, abilities=[])).post("tools/list")

    assert response.status_code == 403
    assert response.json() == {"error": "You are not allowed to do that."}


def test_a_session_cookie_does_not_reach_the_mcp_server(authenticated_client: TestClient) -> None:
    assert McpClient(authenticated_client, None).post("tools/list").status_code == 401


def test_using_a_token_records_when_it_was_last_used(
    client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    token = issue_token(db_session, user)
    clock.advance(minutes=5)

    McpClient(client, token).result("tools/list")

    stored = db_session.scalar(select(AccessToken).where(AccessToken.id == int(token.split("|")[0])))
    assert stored is not None
    assert stored.last_used_at == START_TIME + timedelta(minutes=5)


def test_requests_are_rate_limited_per_token(client: TestClient, db_session: Session, user: User) -> None:
    mcp = McpClient(client, issue_token(db_session, user))
    for _ in range(REQUESTS_PER_MINUTE):
        assert mcp.post("tools/list").status_code == 200

    response = mcp.post("tools/list")

    assert response.status_code == 429
    assert "Retry-After" in response.headers
    assert McpClient(client, issue_token(db_session, user)).post("tools/list").status_code == 200


def test_initialize_names_the_server_and_explains_the_notes(mcp: McpClient) -> None:
    result = mcp.result(
        "initialize",
        {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}},
    )

    server_info = result["serverInfo"]
    assert isinstance(server_info, dict)
    assert server_info["name"] == "notes"
    assert "note-image:" in str(result["instructions"])


def test_every_tool_is_listed(mcp: McpClient) -> None:
    tools = mcp.result("tools/list")["tools"]

    assert isinstance(tools, list)
    assert {tool["name"] for tool in tools} == TOOL_NAMES


def test_a_read_only_token_cannot_write(client: TestClient, db_session: Session, user: User) -> None:
    mcp = McpClient(client, issue_token(db_session, user, abilities=[READ]))

    assert "notes:write" in mcp.error("create_tag", name="Work")
    assert mcp.ok("list_tags") == {"tags": []}


def test_another_users_notes_are_not_found(mcp: McpClient, db_session: Session) -> None:
    other = make_note(db_session, make_user(db_session), title="Private")

    assert "No note with that uuid" in mcp.error("get_note", uuid=str(other.uuid))
    assert "No note with that uuid" in mcp.error("set_note_starred", uuid=str(other.uuid), starred=True)
