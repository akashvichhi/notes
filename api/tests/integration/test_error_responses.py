from typing import Annotated

from fastapi import FastAPI, Query
from fastapi.testclient import TestClient

from app.constants import messages
from app.core.config import Settings
from app.core.exceptions import ConflictError, RateLimitedError
from tests.conftest import AppFactory


def test_unknown_api_path_returns_the_json_404(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"error": messages.NOT_FOUND}


def test_wrong_method_returns_the_json_405(client: TestClient) -> None:
    response = client.delete("/api/health")

    assert response.status_code == 405
    assert response.json() == {"error": messages.METHOD_NOT_ALLOWED}


def _app_with_probe_routes(build_app: AppFactory, settings: Settings) -> FastAPI:
    app = build_app(settings)

    @app.get("/api/v1/probe/validation")
    def validation_probe(per_page: Annotated[int, Query(ge=1)]) -> dict[str, int]:
        return {"per_page": per_page}

    @app.get("/api/v1/probe/conflict")
    def conflict_probe() -> None:
        raise ConflictError.for_field("name", "A folder with this name already exists.")

    @app.get("/api/v1/probe/rate-limit")
    def rate_limit_probe() -> None:
        raise RateLimitedError(retry_after_seconds=42)

    @app.get("/api/v1/probe/crash")
    def crash_probe() -> None:
        raise RuntimeError("secret internals")

    return app


def test_validation_errors_list_each_field(build_app: AppFactory, test_settings: Settings) -> None:
    with TestClient(_app_with_probe_routes(build_app, test_settings)) as client:
        response = client.get("/api/v1/probe/validation", params={"per_page": 0})

    assert response.status_code == 422
    body = response.json()
    assert body["error"] == messages.VALIDATION_FAILED
    assert [detail["field"] for detail in body["details"]] == ["per_page"]


def test_domain_error_about_one_field_returns_its_status_and_details(
    build_app: AppFactory, test_settings: Settings
) -> None:
    with TestClient(_app_with_probe_routes(build_app, test_settings)) as client:
        response = client.get("/api/v1/probe/conflict")

    assert response.status_code == 409
    assert response.json() == {
        "error": messages.VALIDATION_FAILED,
        "details": [{"field": "name", "message": "A folder with this name already exists."}],
    }


def test_rate_limit_error_says_when_to_retry(build_app: AppFactory, test_settings: Settings) -> None:
    with TestClient(_app_with_probe_routes(build_app, test_settings)) as client:
        response = client.get("/api/v1/probe/rate-limit")

    assert response.status_code == 429
    assert response.headers["retry-after"] == "42"
    assert response.json() == {"error": messages.TOO_MANY_REQUESTS}


def test_unexpected_error_returns_a_generic_500_without_internals(
    build_app: AppFactory, test_settings: Settings
) -> None:
    app = _app_with_probe_routes(build_app, test_settings)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/v1/probe/crash")

    assert response.status_code == 500
    assert response.json() == {"error": messages.SERVER_ERROR}
    assert "secret internals" not in response.text
