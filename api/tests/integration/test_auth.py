from datetime import timedelta
from http.cookies import SimpleCookie

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants import messages
from app.core.security import hash_token
from app.models.user_model import User
from app.models.user_session_model import UserSession
from tests.factories import PASSWORD, make_user
from tests.fakes import FakeClock
from tests.unit.core.test_security import LEGACY_HASH_OF_PASSWORD

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"
COOKIE = "notes_session"
THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60


def _registration(**overrides: str) -> dict[str, str]:
    return {
        "name": "Asha Rao",
        "email": "asha@example.com",
        "password": "long enough",
        "password_confirmation": "long enough",
    } | overrides


def _set_cookie(response_headers: list[str]) -> SimpleCookie:
    cookie: SimpleCookie = SimpleCookie()
    for header in response_headers:
        cookie.load(header)
    return cookie


def _session_count(db_session: Session) -> int:
    return db_session.scalar(select(func.count()).select_from(UserSession)) or 0


def test_register_creates_the_account_and_signs_in(client: TestClient) -> None:
    response = client.post(REGISTER, json=_registration())

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Asha Rao"
    assert data["email"] == "asha@example.com"
    assert data["preferences"] == {}
    assert set(data) == {"uuid", "name", "email", "preferences"}
    assert client.get(ME).json()["data"]["uuid"] == data["uuid"]


def test_register_trims_the_name_and_lowercases_the_email(client: TestClient) -> None:
    response = client.post(REGISTER, json=_registration(name="  Asha  ", email=" Asha@Example.COM "))

    assert response.json()["data"]["name"] == "Asha"
    assert response.json()["data"]["email"] == "asha@example.com"


def test_register_rejects_an_email_already_taken_in_any_case(client: TestClient, db_session: Session) -> None:
    make_user(db_session, email="asha@example.com")

    response = client.post(REGISTER, json=_registration(email="ASHA@example.com"))

    assert response.status_code == 409
    assert response.json()["details"] == [{"field": "email", "message": messages.EMAIL_TAKEN}]


def test_register_validates_every_field(client: TestClient) -> None:
    response = client.post(
        REGISTER,
        json=_registration(
            name="x" * 121, email="not-an-email", password="short", password_confirmation="other"
        ),
    )

    assert response.status_code == 422
    fields = {detail["field"] for detail in response.json()["details"]}
    assert fields == {"name", "email", "password"}


def test_register_says_how_long_a_password_must_be(client: TestClient) -> None:
    response = client.post(REGISTER, json=_registration(password="short", password_confirmation="short"))

    assert response.json()["details"] == [
        {"field": "password", "message": "Password must be at least 8 characters."}
    ]


def test_register_requires_a_matching_confirmation(client: TestClient) -> None:
    response = client.post(REGISTER, json=_registration(password_confirmation="something else"))

    assert response.json()["details"] == [
        {"field": "password", "message": messages.PASSWORD_CONFIRMATION_MISMATCH}
    ]


def test_missing_field_says_it_is_required(client: TestClient) -> None:
    response = client.post(LOGIN, json={"email": "asha@example.com"})

    assert response.status_code == 422
    assert response.json()["details"] == [{"field": "password", "message": "Password is required."}]


def test_login_returns_the_user_and_sets_the_session_cookie(client: TestClient, user: User) -> None:
    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})

    assert response.status_code == 200
    assert response.json()["data"]["uuid"] == str(user.uuid)
    cookie = _set_cookie(response.headers.get_list("set-cookie"))[COOKIE]
    assert cookie["httponly"]
    assert cookie["secure"]
    assert cookie["samesite"] == "lax"
    assert cookie["path"] == "/"
    assert cookie["max-age"] == str(THIRTY_DAYS_IN_SECONDS)


def test_login_stores_only_the_hash_of_the_session_id(
    client: TestClient, user: User, db_session: Session
) -> None:
    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})
    session_id = response.cookies[COOKIE]

    stored = db_session.scalars(select(UserSession.token_hash)).all()

    assert stored == [hash_token(session_id)]


def test_every_login_gets_a_new_session_id(client: TestClient, user: User) -> None:
    first = client.post(LOGIN, json={"email": user.email, "password": PASSWORD}).cookies[COOKIE]
    second = client.post(LOGIN, json={"email": user.email, "password": PASSWORD}).cookies[COOKIE]

    assert first != second


def test_login_ignores_the_case_of_the_email(client: TestClient, db_session: Session) -> None:
    make_user(db_session, email="asha@example.com")

    response = client.post(LOGIN, json={"email": "ASHA@Example.com", "password": PASSWORD})

    assert response.status_code == 200


def test_wrong_password_and_unknown_email_get_the_same_401(client: TestClient, user: User) -> None:
    wrong_password = client.post(LOGIN, json={"email": user.email, "password": "not it"})
    unknown_email = client.post(LOGIN, json={"email": "nobody@example.com", "password": PASSWORD})

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json() == {"error": messages.INVALID_CREDENTIALS}


def test_legacy_password_hash_signs_in_and_is_upgraded(client: TestClient, db_session: Session) -> None:
    user = make_user(db_session)
    user.password_hash = LEGACY_HASH_OF_PASSWORD
    db_session.flush()

    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})

    assert response.status_code == 200
    db_session.refresh(user)
    assert user.password_hash.startswith("$argon2id$")


def test_me_without_a_session_is_401(client: TestClient) -> None:
    response = client.get(ME)

    assert response.status_code == 401
    assert response.json() == {"error": messages.UNAUTHENTICATED}


def test_me_with_an_unknown_session_id_is_401(client: TestClient) -> None:
    client.cookies.set(COOKIE, "made-up")

    assert client.get(ME).status_code == 401


def test_expired_session_is_rejected_and_deleted(
    authenticated_client: TestClient, clock: FakeClock, db_session: Session
) -> None:
    clock.advance(days=31)

    response = authenticated_client.get(ME)

    assert response.status_code == 401
    assert _session_count(db_session) == 0


def test_session_slides_forward_while_it_is_used(
    authenticated_client: TestClient, clock: FakeClock, db_session: Session
) -> None:
    clock.advance(days=20)

    response = authenticated_client.get(ME)

    assert response.status_code == 200
    expires_at = db_session.scalars(select(UserSession.expires_at)).one()
    assert expires_at == clock.now() + timedelta(days=30)
    cookie = _set_cookie(response.headers.get_list("set-cookie"))[COOKIE]
    assert cookie["max-age"] == str(THIRTY_DAYS_IN_SECONDS)


def test_session_is_not_rewritten_on_every_request(
    authenticated_client: TestClient, clock: FakeClock
) -> None:
    clock.advance(hours=1)

    response = authenticated_client.get(ME)

    assert "set-cookie" not in response.headers


def test_logout_ends_the_session(authenticated_client: TestClient, db_session: Session) -> None:
    session_id = authenticated_client.cookies[COOKIE]

    response = authenticated_client.post(LOGOUT)

    assert response.status_code == 204
    assert response.content == b""
    assert _session_count(db_session) == 0
    authenticated_client.cookies.set(COOKIE, session_id)
    assert authenticated_client.get(ME).status_code == 401


def test_logout_clears_the_cookie(authenticated_client: TestClient) -> None:
    response = authenticated_client.post(LOGOUT)

    cookie = _set_cookie(response.headers.get_list("set-cookie"))[COOKIE]
    assert cookie.value == ""
    assert cookie["max-age"] == "0"


def test_logout_without_a_session_still_succeeds(client: TestClient) -> None:
    assert client.post(LOGOUT).status_code == 204


def test_login_is_limited_per_ip(client: TestClient, user: User) -> None:
    for attempt in range(5):
        client.post(LOGIN, json={"email": f"other{attempt}@example.com", "password": "nope"})

    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})

    assert response.status_code == 429
    assert response.json() == {"error": messages.TOO_MANY_REQUESTS}
    assert int(response.headers["retry-after"]) > 0


def _from_address(client: TestClient, address: str) -> TestClient:
    """Another client of the same app (so the same rate limiter), from a different IP."""
    return TestClient(client.app, base_url=str(client.base_url), client=(address, 50000))


def test_failed_logins_are_limited_per_email(client: TestClient, user: User) -> None:
    # A different address each time, so only the per-email limit can trigger.
    for attempt in range(5):
        _from_address(client, f"10.0.0.{attempt}").post(LOGIN, json={"email": user.email, "password": "nope"})

    response = _from_address(client, "10.0.1.1").post(LOGIN, json={"email": user.email, "password": PASSWORD})

    assert response.status_code == 429


def test_a_successful_login_resets_the_failed_attempts(client: TestClient, user: User) -> None:
    addresses = (f"10.0.2.{number}" for number in range(10))
    for _ in range(4):
        _from_address(client, next(addresses)).post(LOGIN, json={"email": user.email, "password": "nope"})
    _from_address(client, next(addresses)).post(LOGIN, json={"email": user.email, "password": PASSWORD})

    for _ in range(4):
        _from_address(client, next(addresses)).post(LOGIN, json={"email": user.email, "password": "nope"})
    response = _from_address(client, next(addresses)).post(
        LOGIN, json={"email": user.email, "password": PASSWORD}
    )

    assert response.status_code == 200


def test_register_is_limited_per_ip(client: TestClient) -> None:
    for attempt in range(5):
        client.post(REGISTER, json=_registration(email=f"user{attempt}@example.com"))

    response = client.post(REGISTER, json=_registration(email="one-more@example.com"))

    assert response.status_code == 429


def test_login_from_a_foreign_origin_is_rejected(client: TestClient, user: User) -> None:
    response = client.post(
        LOGIN, json={"email": user.email, "password": PASSWORD}, headers={"Origin": "https://evil.example"}
    )

    assert response.status_code == 403


def test_wrong_credentials_say_so_plainly(client: TestClient, user: User) -> None:
    response = client.post(LOGIN, json={"email": user.email, "password": "not the password"})

    assert response.status_code == 401
    assert response.json() == {"error": "Incorrect email or password."}
