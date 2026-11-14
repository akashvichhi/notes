from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.constants import messages
from app.core.config import Settings
from tests.conftest import ClientFactory

INDEX_HTML = "<!doctype html><title>Notes</title>"
ASSET_JS = "console.log('app')"
FAVICON = "icon"


@pytest.fixture
def web_client(build_client: ClientFactory, test_settings: Settings, tmp_path: Path) -> TestClient:
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text(INDEX_HTML)
    (tmp_path / "assets" / "app-1a2b3c.js").write_text(ASSET_JS)
    (tmp_path / "favicon.svg").write_text(FAVICON)
    return build_client(test_settings.model_copy(update={"web_dist_dir": tmp_path}))


def test_page_path_serves_index_html_without_caching(web_client: TestClient) -> None:
    response = web_client.get("/notes/7b0c1d9e-0000-4000-8000-000000000000")

    assert response.status_code == 200
    assert response.text == INDEX_HTML
    assert response.headers["cache-control"] == "no-cache"


def test_root_serves_index_html(web_client: TestClient) -> None:
    assert web_client.get("/").text == INDEX_HTML


def test_file_in_the_build_root_is_served(web_client: TestClient) -> None:
    response = web_client.get("/favicon.svg")

    assert response.status_code == 200
    assert response.text == FAVICON


def test_path_outside_the_build_folder_gets_index_html(web_client: TestClient) -> None:
    assert web_client.get("/..%2F..%2Fpyproject.toml").text == INDEX_HTML


def test_asset_is_cached_forever(web_client: TestClient) -> None:
    response = web_client.get("/assets/app-1a2b3c.js")

    assert response.status_code == 200
    assert response.text == ASSET_JS
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_missing_asset_is_a_plain_404_never_index_html(web_client: TestClient) -> None:
    response = web_client.get("/assets/missing.js")

    assert response.status_code == 404
    assert INDEX_HTML not in response.text


def test_unknown_api_path_never_gets_index_html(web_client: TestClient) -> None:
    response = web_client.get("/api/v1/unknown")

    assert response.status_code == 404
    assert response.json() == {"error": messages.NOT_FOUND}


def test_page_paths_are_json_404_when_the_web_app_is_not_built(client: TestClient) -> None:
    response = client.get("/notes")

    assert response.status_code == 404
    assert response.json() == {"error": messages.NOT_FOUND}
