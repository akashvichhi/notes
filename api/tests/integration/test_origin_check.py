from fastapi.testclient import TestClient

from app.constants import messages
from tests.conftest import ALLOWED_ORIGIN


def test_write_from_a_foreign_origin_is_rejected(client: TestClient) -> None:
    response = client.post("/api/v1/anything", headers={"Origin": "https://evil.example"})

    assert response.status_code == 403
    assert response.json() == {"error": messages.FOREIGN_ORIGIN}


def test_write_from_the_allowed_origin_reaches_the_api(client: TestClient) -> None:
    response = client.post("/api/v1/anything", headers={"Origin": ALLOWED_ORIGIN})

    assert response.status_code == 404


def test_allowed_origin_with_a_trailing_slash_still_matches(client: TestClient) -> None:
    response = client.post("/api/v1/anything", headers={"Origin": f"{ALLOWED_ORIGIN}/"})

    assert response.status_code == 404


def test_write_without_an_origin_header_passes(client: TestClient) -> None:
    assert client.post("/api/v1/anything").status_code == 404


def test_read_from_a_foreign_origin_passes(client: TestClient) -> None:
    response = client.get("/api/health", headers={"Origin": "https://evil.example"})

    assert response.status_code == 200
