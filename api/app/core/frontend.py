"""Serves the web app's build (web/dist) from the API's own origin.

/assets/* are content-hashed, so they are cached forever and a missing one is a plain
404. Other page paths get a file from the build root when one exists (favicon, icons),
else index.html with no-cache, so client-side routes and reloads after a deploy work."""

from pathlib import Path

from fastapi import FastAPI
from starlette.responses import FileResponse, Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.constants.http_constants import (
    API_PATH_PREFIX,
    ASSETS_PATH_PREFIX,
    CACHE_CONTROL_IMMUTABLE,
    CACHE_CONTROL_NO_CACHE,
    INDEX_FILE_NAME,
    MCP_PATH,
)

ASSETS_DIR_NAME = "assets"


def _is_under(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(f"{prefix}/")


class ImmutableStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = CACHE_CONTROL_IMMUTABLE
        return response


class Frontend:
    def __init__(self, dist_dir: Path) -> None:
        self._dist_dir = dist_dir.resolve()
        self._index_file = self._dist_dir / INDEX_FILE_NAME

    @property
    def is_built(self) -> bool:
        return self._index_file.is_file()

    def mount_assets(self, app: FastAPI) -> None:
        assets_dir = self._dist_dir / ASSETS_DIR_NAME
        if assets_dir.is_dir():
            app.mount(ASSETS_PATH_PREFIX, ImmutableStaticFiles(directory=assets_dir), name="assets")

    def serves_page(self, path: str) -> bool:
        """Whether an unmatched GET for this path is a page of the web app."""
        if not self.is_built:
            return False
        return not any(_is_under(path, prefix) for prefix in (API_PATH_PREFIX, MCP_PATH, ASSETS_PATH_PREFIX))

    def page_response(self, path: str) -> FileResponse:
        return FileResponse(
            self._root_file(path) or self._index_file, headers={"Cache-Control": CACHE_CONTROL_NO_CACHE}
        )

    def _root_file(self, path: str) -> Path | None:
        candidate = (self._dist_dir / path.lstrip("/")).resolve()
        # resolve() collapses "..", so this also keeps the request inside the build folder.
        if candidate == self._dist_dir or not candidate.is_relative_to(self._dist_dir):
            return None
        return candidate if candidate.is_file() else None
