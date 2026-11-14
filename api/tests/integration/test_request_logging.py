import logging

import pytest
from fastapi.testclient import TestClient


def test_request_log_has_the_route_and_status_but_never_the_query(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="app.requests"):
        client.get("/api/health", params={"q": "private search"})

    lines = [record.getMessage() for record in caplog.records if record.name == "app.requests"]
    assert len(lines) == 1
    assert lines[0].startswith("GET /api/health 200 ")
    assert "private" not in lines[0]


def test_unmatched_path_is_logged_without_the_path(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="app.requests"):
        client.get("/api/v1/tags/my-private-tag")

    lines = [record.getMessage() for record in caplog.records if record.name == "app.requests"]
    assert len(lines) == 1
    assert lines[0].startswith("GET - 404 ")
    assert "my-private-tag" not in lines[0]
