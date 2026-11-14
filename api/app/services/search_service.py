"""Search: notes by the words they contain, folders and tags by how their name starts."""

from app.constants.search_constants import SEARCH_NAME_RESULTS_MAX, SEARCH_NOTE_RESULTS_MAX
from app.content.search_terms import parse_search_terms
from app.content.snippet import build_snippet
from app.models.note_model import Note
from app.models.user_model import User
from app.repositories.folder_repository import FolderRepository
from app.repositories.note_repository import NoteRepository
from app.repositories.tag_repository import TagRepository
from app.schemas.requests.search_request import SearchRequest
from app.schemas.resources.search_resource import (
    SearchFolderResource,
    SearchNoteResource,
    SearchResultsResource,
)
from app.schemas.resources.tag_resource import TagResource


class SearchService:
    def __init__(self, notes: NoteRepository, folders: FolderRepository, tags: TagRepository) -> None:
        self._notes = notes
        self._folders = folders
        self._tags = tags

    def search(self, user: User, request: SearchRequest) -> SearchResultsResource:
        terms = parse_search_terms(request.q)
        # A query of short words only can still match folder and tag names.
        notes = self._notes.search(user.id, terms, SEARCH_NOTE_RESULTS_MAX) if terms else []
        folders = self._folders.find_by_name_prefix(user.id, request.q, SEARCH_NAME_RESULTS_MAX)
        tags = self._tags.find_by_name_prefix(user.id, request.q, SEARCH_NAME_RESULTS_MAX)
        return SearchResultsResource(
            notes=[_note_hit(note, terms) for note in notes],
            folders=[SearchFolderResource.from_model(folder) for folder in folders],
            tags=[TagResource.from_model(tag) for tag in tags],
        )


def _note_hit(note: Note, terms: list[str]) -> SearchNoteResource:
    return SearchNoteResource(
        uuid=note.uuid, title=note.title, snippet=build_snippet(note.plain_text, terms), terms=terms
    )
