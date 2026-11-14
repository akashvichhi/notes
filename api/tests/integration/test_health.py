from fastapi.testclient import TestClient


def test_health_answers_ok_once_the_database_responds(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"data": {"status": "ok"}}


def test_health_needs_no_session(client: TestClient) -> None:
    client.cookies.clear()

    assert client.get("/api/health").status_code == 200
