from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user_model import User
from tests.factories import make_folder, make_note, make_tag, make_user
from tests.fakes import FakeClock

SEARCH = "/api/v1/search"
SEARCHES_PER_MINUTE = 60
NOTE_RESULTS_MAX = 20
NAME_RESULTS_MAX = 5


def _search(client: TestClient, query: str) -> dict[str, list[dict[str, object]]]:
    response = client.get(SEARCH, params={"q": query})
    assert response.status_code == 200
    data: dict[str, list[dict[str, object]]] = response.json()["data"]
    return data


def _titles(results: dict[str, list[dict[str, object]]]) -> list[str]:
    return [str(note["title"]) for note in results["notes"]]


def test_search_needs_a_session(client: TestClient) -> None:
    assert client.get(SEARCH, params={"q": "plan"}).status_code == 401


def test_search_matches_word_prefixes_in_the_title_or_the_text(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_note(db_session, user, title="Release plan")
    make_note(db_session, user, title="Friday", plain_text="We ship the release on Friday")
    make_note(db_session, user, title="Groceries", plain_text="Milk and eggs")

    results = _search(authenticated_client, "RELE")

    assert sorted(_titles(results)) == ["Friday", "Release plan"]


def test_search_returns_a_snippet_and_the_terms_newest_edit_first(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    older = make_note(db_session, user, title="Older", plain_text="The launch is next week")
    newer = make_note(db_session, user, title="Newer", plain_text="Launch day notes")
    older.updated_at = clock.now() - timedelta(days=2)
    newer.updated_at = clock.now() - timedelta(days=1)
    db_session.flush()

    results = _search(authenticated_client, "launch")

    assert results["notes"] == [
        {"uuid": str(newer.uuid), "title": "Newer", "snippet": "Launch day notes", "terms": ["launch"]},
        {
            "uuid": str(older.uuid),
            "title": "Older",
            "snippet": "The launch is next week",
            "terms": ["launch"],
        },
    ]


def test_every_term_must_match(authenticated_client: TestClient, db_session: Session, user: User) -> None:
    make_note(db_session, user, title="Both", plain_text="release on friday")
    make_note(db_session, user, title="One", plain_text="release soon")

    assert _titles(_search(authenticated_client, "release friday")) == ["Both"]


def test_terms_shorter_than_three_characters_are_ignored(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_note(db_session, user, title="Plan")

    results = _search(authenticated_client, "a plan")

    assert _titles(results) == ["Plan"]
    assert results["notes"][0]["terms"] == ["plan"]


def test_search_skips_trashed_and_other_users_notes(
    authenticated_client: TestClient, db_session: Session, user: User, clock: FakeClock
) -> None:
    trashed = make_note(db_session, user, title="Budget old")
    trashed.deleted_at = clock.now()
    make_note(db_session, make_user(db_session), title="Budget theirs")
    db_session.flush()

    assert _search(authenticated_client, "budget")["notes"] == []


def test_query_syntax_characters_are_plain_text(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_note(db_session, user, title="Notes")

    results = _search(authenticated_client, "(notes) & | !")

    assert _titles(results) == ["Notes"]


def test_search_returns_at_most_twenty_notes(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    for number in range(NOTE_RESULTS_MAX + 1):
        make_note(db_session, user, title=f"Meeting {number}")

    assert len(_search(authenticated_client, "meeting")["notes"]) == NOTE_RESULTS_MAX


def test_search_finds_folders_and_tags_by_name_prefix(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    folder = make_folder(db_session, user, name="Work")
    make_folder(db_session, user, name="Homework")
    make_folder(db_session, make_user(db_session), name="Work theirs")
    tag = make_tag(db_session, user, name="Workshop", slug="workshop")
    make_tag(db_session, user, name="Side work", slug="side-work")

    results = _search(authenticated_client, "WOR")

    assert results["folders"] == [{"uuid": str(folder.uuid), "name": "Work"}]
    assert results["tags"] == [{"uuid": str(tag.uuid), "name": "Workshop", "slug": "workshop"}]


def test_percent_and_underscore_in_a_name_search_match_literally(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    make_folder(db_session, user, name="100% done")
    make_folder(db_session, user, name="100x")
    make_tag(db_session, user, name="to_do", slug="to-do")
    make_tag(db_session, user, name="toxdo", slug="toxdo")

    assert [folder["name"] for folder in _search(authenticated_client, "100%")["folders"]] == ["100% done"]
    assert [tag["name"] for tag in _search(authenticated_client, "to_")["tags"]] == ["to_do"]


def test_name_matches_are_capped_at_five(
    authenticated_client: TestClient, db_session: Session, user: User
) -> None:
    for number in range(NAME_RESULTS_MAX + 1):
        make_folder(db_session, user, name=f"Archive {number}")

    assert len(_search(authenticated_client, "archive")["folders"]) == NAME_RESULTS_MAX


def test_the_query_must_be_three_to_120_characters(authenticated_client: TestClient) -> None:
    for params in ({}, {"q": "ab"}, {"q": "  ab  "}, {"q": "x" * 121}):
        response = authenticated_client.get(SEARCH, params=params)

        assert response.status_code == 422
        assert [detail["field"] for detail in response.json()["details"]] == ["q"]


def test_searches_are_rate_limited_per_user(authenticated_client: TestClient) -> None:
    for _ in range(SEARCHES_PER_MINUTE):
        authenticated_client.get(SEARCH, params={"q": "plan"})

    response = authenticated_client.get(SEARCH, params={"q": "plan"})

    assert response.status_code == 429
    assert "Retry-After" in response.headers
