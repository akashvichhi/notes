"""Folder paths such as "Work / Projects", built from one list of the user's folders."""

from app.constants.mcp_constants import FOLDER_PATH_SEPARATOR
from app.models.folder_model import Folder


class FolderPaths:
    def __init__(self, folders: list[Folder]) -> None:
        self._by_id = {folder.id: folder for folder in folders}

    def path(self, folder_id: int | None) -> str | None:
        """The names from the top folder down, or None outside any folder."""
        names: list[str] = []
        seen: set[int] = set()
        # `seen` stops at a cycle, so a corrupt parent chain cannot loop forever.
        while folder_id is not None and folder_id in self._by_id and folder_id not in seen:
            seen.add(folder_id)
            folder = self._by_id[folder_id]
            names.insert(0, folder.name)
            folder_id = folder.parent_id
        return FOLDER_PATH_SEPARATOR.join(names) if names else None
