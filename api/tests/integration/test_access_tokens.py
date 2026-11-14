import hashlib
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.access_token_model import AccessToken
from app.models.user_model import User
from tests.factories import make_access_token, make_user
from tests.fakes import FakeClock

TOKENS = "/api/v1/me/access-tokens"
TOKEN_FIELDS = {"id", "name", "abilities", "created_at", "last_used_at", "expires_at"}
ACTIVE_TOKENS_MAX = 20
TOKEN_CREATES_PER_MINUTE = 10
TOKEN_PREFIX = "notes_pat_"


def _create(client: TestClient, **fields: object) -> dict[str, object]:
    payload = {"name": "Claude", "abilities": ["notes:read"], **fields}
    response = client.post(TOKENS, json=payload)
    assert response.status_code == 201
    data: dict[str, object] = response.json()["data"]
    return data


def test_access_tokens_need_a_session(client: TestClient) -> None:
    assert client.get(TOKENS).status_code == 401
    assert client.post(TOKENS, json={"name": "x", "abilities": ["notes:read"]}).status_code == 401


def test_create_returns_the_token_once_and_stores_only_its_hash(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    data = _create(authenticated_client, name="  Claude desktop  ")

    token_text = str(data["token"])
    token_id, secret = token_text.split("|", 1)
    access_token = data["access_token"]
    assert isinstance(access_token, dict)
    assert set(access_token) == TOKEN_FIELDS
    assert access_token["id"] == int(token_id)
    assert access_token["name"] == "Claude desktop"
    assert access_token["expires_at"] is None
    assert secret.startswith(TOKEN_PREFIX)
    stored = db_session.scalar(select(AccessToken).where(AccessToken.id == int(token_id)))
    assert stored is not None
    assert stored.user_id == user.id
    assert stored.token_hash == hashlib.sha256(secret.encode()).hexdigest()


def test_every_token_is_different(authenticated_client: TestClient) -> None:
    assert _create(authenticated_client)["token"] != _create(authenticated_client)["token"]


def test_write_access_includes_read_access(authenticated_client: TestClient) -> None:
    access_token = _create(authenticated_client, abilities=["notes:write"])["access_token"]

    assert isinstance(access_token, dict)
    assert access_token["abilities"] == ["notes:read", "notes:write"]


def test_a_token_can_expire_after_30_90_or_365_days(
    authenticated_client: TestClient, clock: FakeClock
) -> None:
    access_token = _create(authenticated_client, expires_in_days=90)["access_token"]

    assert isinstance(access_token, dict)
    expires_at = str(access_token["expires_at"])
    assert datetime.fromisoformat(expires_at) == clock.now() + timedelta(days=90)
    assert expires_at.endswith("+05:30")


def test_create_validates_the_fields(authenticated_client: TestClient) -> None:
    cases = [
        ({"abilities": ["notes:read"]}, "name"),
        ({"name": "   ", "abilities": ["notes:read"]}, "name"),
        ({"name": "x" * 61, "abilities": ["notes:read"]}, "name"),
        ({"name": "Claude"}, "abilities"),
        ({"name": "Claude", "abilities": []}, "abilities"),
        ({"name": "Claude", "abilities": ["account"]}, "abilities"),
        ({"name": "Claude", "abilities": ["notes:read", "notes:read"]}, "abilities"),
        ({"name": "Claude", "abilities": ["notes:read"], "expires_in_days": 7}, "expires_in_days"),
    ]
    for payload, field in cases:
        response = authenticated_client.post(TOKENS, json=payload)

        assert response.status_code == 422, payload
        assert [detail["field"] for detail in response.json()["details"]] == [field], payload


def test_at_most_twenty_active_tokens(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    for _ in range(ACTIVE_TOKENS_MAX - 1):
        make_access_token(db_session, user)
    make_access_token(db_session, user, expires_at=clock.now() - timedelta(days=1))

    _create(authenticated_client)
    response = authenticated_client.post(TOKENS, json={"name": "One more", "abilities": ["notes:read"]})

    assert response.status_code == 422
    assert [detail["field"] for detail in response.json()["details"]] == ["name"]


def test_creating_tokens_is_rate_limited(authenticated_client: TestClient) -> None:
    for _ in range(TOKEN_CREATES_PER_MINUTE):
        authenticated_client.post(TOKENS, json={"name": "Claude", "abilities": ["notes:read"]})

    response = authenticated_client.post(TOKENS, json={"name": "Claude", "abilities": ["notes:read"]})

    assert response.status_code == 429
    assert "Retry-After" in response.headers


def test_list_shows_your_tokens_newest_first_without_the_secret(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    older = make_access_token(db_session, user, name="Older")
    newer = make_access_token(db_session, user, name="Newer", abilities=["notes:read", "notes:write"])
    make_access_token(db_session, make_user(db_session), name="Theirs")

    response = authenticated_client.get(TOKENS)

    assert response.status_code == 200
    data = response.json()["data"]
    assert [token["id"] for token in data] == [newer.id, older.id]
    assert set(data[0]) == TOKEN_FIELDS
    assert data[0]["abilities"] == ["notes:read", "notes:write"]


def test_revoke_deletes_your_token(authenticated_client: TestClient, db_session: Session, user: User) -> None:
    token = make_access_token(db_session, user)

    response = authenticated_client.delete(f"{TOKENS}/{token.id}")

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(AccessToken, token.id) is None


def test_another_users_token_is_not_found(authenticated_client: TestClient, db_session: Session) -> None:
    theirs = make_access_token(db_session, make_user(db_session))

    assert authenticated_client.delete(f"{TOKENS}/{theirs.id}").status_code == 404
    assert authenticated_client.delete(f"{TOKENS}/999999999").status_code == 404
