from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants import messages
from app.models.access_token_model import AccessToken
from app.models.user_model import User
from app.models.user_session_model import UserSession
from tests.factories import PASSWORD, make_user
from tests.fakes import FakeClock

PROFILE = "/api/v1/me"
PASSWORD_PATH = "/api/v1/me/password"
PREFERENCES = "/api/v1/me/preferences"
LOGIN = "/api/v1/auth/login"
ME = "/api/v1/auth/me"
COOKIE = "notes_session"


def _password_change(**overrides: str) -> dict[str, str]:
    return {
        "current_password": PASSWORD,
        "password": "a brand new one",
        "password_confirmation": "a brand new one",
    } | overrides


def test_profile_endpoints_need_a_session(client: TestClient) -> None:
    assert client.patch(PROFILE, json={"name": "New"}).status_code == 401
    assert client.put(PASSWORD_PATH, json=_password_change()).status_code == 401
    assert client.patch(PREFERENCES, json={"theme": "dark"}).status_code == 401


def test_update_profile_changes_only_the_fields_sent(authenticated_client: TestClient, user: User) -> None:
    response = authenticated_client.patch(PROFILE, json={"name": "  Asha Rao  "})

    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Asha Rao"
    assert response.json()["data"]["email"] == user.email


def test_update_profile_lowercases_a_new_email(authenticated_client: TestClient) -> None:
    response = authenticated_client.patch(PROFILE, json={"email": "New@Example.com"})

    assert response.json()["data"]["email"] == "new@example.com"


def test_update_profile_rejects_another_users_email(
    authenticated_client: TestClient, db_session: Session
) -> None:
    make_user(db_session, email="taken@example.com")

    response = authenticated_client.patch(PROFILE, json={"email": "TAKEN@example.com"})

    assert response.status_code == 409
    assert response.json()["details"] == [{"field": "email", "message": messages.EMAIL_TAKEN}]


def test_update_profile_keeps_your_own_email(authenticated_client: TestClient, user: User) -> None:
    response = authenticated_client.patch(PROFILE, json={"email": user.email.upper()})

    assert response.status_code == 200


def test_update_profile_rejects_a_blank_name(authenticated_client: TestClient) -> None:
    response = authenticated_client.patch(PROFILE, json={"name": "   "})

    assert response.status_code == 422
    assert response.json()["details"][0]["field"] == "name"


def test_change_password_needs_the_current_one(authenticated_client: TestClient) -> None:
    response = authenticated_client.put(PASSWORD_PATH, json=_password_change(current_password="wrong"))

    assert response.status_code == 422
    assert response.json()["details"] == [
        {"field": "current_password", "message": messages.CURRENT_PASSWORD_INCORRECT}
    ]


def test_change_password_needs_a_matching_confirmation(authenticated_client: TestClient) -> None:
    response = authenticated_client.put(PASSWORD_PATH, json=_password_change(password_confirmation="other"))

    assert response.status_code == 422
    assert response.json()["details"][0]["field"] == "password"


def test_change_password_switches_the_password(authenticated_client: TestClient, user: User) -> None:
    response = authenticated_client.put(PASSWORD_PATH, json=_password_change())

    assert response.status_code == 204
    old = authenticated_client.post(LOGIN, json={"email": user.email, "password": PASSWORD})
    new = authenticated_client.post(LOGIN, json={"email": user.email, "password": "a brand new one"})
    assert old.status_code == 401
    assert new.status_code == 200


def test_change_password_keeps_this_browser_signed_in_with_a_new_session_id(
    authenticated_client: TestClient,
) -> None:
    before = authenticated_client.cookies[COOKIE]

    response = authenticated_client.put(PASSWORD_PATH, json=_password_change())

    assert response.cookies[COOKIE] != before
    assert authenticated_client.get(ME).status_code == 200


def test_change_password_signs_out_every_other_session(
    authenticated_client: TestClient, user: User, db_session: Session
) -> None:
    other_browser = TestClient(authenticated_client.app, base_url=str(authenticated_client.base_url))
    other_browser.post(LOGIN, json={"email": user.email, "password": PASSWORD})

    authenticated_client.put(PASSWORD_PATH, json=_password_change())

    assert other_browser.get(ME).status_code == 401
    assert db_session.scalar(select(func.count()).select_from(UserSession)) == 1


def test_change_password_revokes_every_access_token(
    authenticated_client: TestClient, user: User, db_session: Session, clock: FakeClock
) -> None:
    db_session.add(AccessToken(user_id=user.id, name="Claude", token_hash="a" * 64, abilities=["notes:read"]))
    db_session.add(
        AccessToken(
            user_id=user.id,
            name="Other",
            token_hash="b" * 64,
            abilities=["notes:read"],
            expires_at=clock.now() + timedelta(days=30),
        )
    )
    db_session.flush()

    authenticated_client.put(PASSWORD_PATH, json=_password_change())

    assert db_session.scalar(select(func.count()).select_from(AccessToken)) == 0


def test_preferences_are_merged_into_the_existing_ones(authenticated_client: TestClient) -> None:
    authenticated_client.patch(PREFERENCES, json={"theme": "dark", "group_by_date": True})

    response = authenticated_client.patch(PREFERENCES, json={"sort": "title"})

    assert response.status_code == 200
    assert response.json()["data"]["preferences"] == {"theme": "dark", "group_by_date": True, "sort": "title"}


def test_preferences_reject_unknown_values(authenticated_client: TestClient) -> None:
    response = authenticated_client.patch(PREFERENCES, json={"theme": "purple", "show_snippets": "maybe"})

    assert response.status_code == 422
    fields = {detail["field"] for detail in response.json()["details"]}
    assert fields == {"theme", "show_snippets"}


def test_preferences_ignore_keys_they_do_not_know(authenticated_client: TestClient) -> None:
    response = authenticated_client.patch(PREFERENCES, json={"theme": "light", "font": "Comic Sans"})

    assert response.json()["data"]["preferences"] == {"theme": "light"}
