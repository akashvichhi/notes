"""Notes for the MCP tools: bodies go in and out as Markdown, and every lookup names what
an assistant should do when it fails. Saving goes through NoteService, so the version
check and the derived text are the same as the web app's."""

import json
import math
from collections.abc import Callable
from uuid import UUID

from app.constants import messages
from app.constants.mcp_constants import NoteBodyMode
from app.constants.note_constants import EMPTY_DOCUMENT_JSON, NOTE_TAG_NAMES_MAX
from app.constants.search_constants import SEARCH_NOTE_RESULTS_MAX
from app.content.content_error import ContentError
from app.content.document_to_markdown import document_to_markdown
from app.content.document_values import children, is_blank, node_type
from app.content.markdown_to_document import markdown_to_document
from app.content.search_terms import parse_search_terms
from app.content.slug import slugify
from app.content.snippet import build_snippet
from app.content.text_rules import trim_ascii
from app.core.exceptions import ConflictError, DomainValidationError, NoteConflictError, NotFoundError
from app.models.note_model import Note
from app.models.user_model import User
from app.repositories.folder_repository import FolderRepository
from app.repositories.note_repository import NoteRepository
from app.schemas.common.json_types import JsonObject, JsonValue
from app.schemas.requests.note_request import (
    NoteListRequest,
    SetNoteTagsRequest,
    UpdateNoteRequest,
    WriteNoteRequest,
    body_limit_error,
)
from app.schemas.resources.mcp_note_resource import (
    McpNoteListResource,
    McpNoteResource,
    McpNoteSummaryResource,
    McpSavedNoteResource,
    McpSearchResultsResource,
)
from app.services.folder_paths import FolderPaths
from app.services.note_service import NoteService

# Each takes the note's tag names now and the names given, and returns the new list.
type TagCombiner = Callable[[list[str], list[str]], list[str]]


class McpNoteService:
    def __init__(self, notes_service: NoteService, notes: NoteRepository, folders: FolderRepository) -> None:
        self._notes_service = notes_service
        self._notes = notes
        self._folders = folders

    # ── Reading ─────────────────────────────────────────────────────────────

    def get(self, user: User, note_uuid: UUID) -> McpNoteResource:
        note = self._readable(user, note_uuid)
        markdown = document_to_markdown(note.body)
        return McpNoteResource.from_model(note, self._paths(user).path(note.folder_id), markdown)

    def page(self, user: User, request: NoteListRequest) -> McpNoteListResource:
        folder_id = self._folder_id(user, request.folder_id)
        if request.tag is not None:
            request = request.model_copy(update={"tag": slugify(request.tag)})
        notes, total = self._notes.page(user.id, request, folder_id)
        paths = self._paths(user)
        return McpNoteListResource(
            notes=[McpNoteSummaryResource.from_model(note, paths.path(note.folder_id)) for note in notes],
            page=request.page,
            per_page=request.per_page,
            total=total,
            last_page=max(1, math.ceil(total / request.per_page)),
        )

    def search(self, user: User, query: str) -> McpSearchResultsResource:
        terms = parse_search_terms(query)
        # Words shorter than a term can never match, so a query of only those finds nothing.
        hits = self._notes.search(user.id, terms, SEARCH_NOTE_RESULTS_MAX) if terms else []
        loaded = self._notes.active_by_uuids(user.id, [hit.uuid for hit in hits])
        paths = self._paths(user)
        results = [
            McpNoteSummaryResource.from_model(
                loaded[hit.uuid], paths.path(loaded[hit.uuid].folder_id), build_snippet(hit.plain_text, terms)
            )
            for hit in hits
            if hit.uuid in loaded
        ]
        return McpSearchResultsResource(query=query, count=len(results), notes=results)

    # ── Writing ─────────────────────────────────────────────────────────────

    def create(
        self, user: User, title: str, markdown: str | None, folder_uuid: UUID | None, tag_names: list[str]
    ) -> McpSavedNoteResource:
        self._folder_id(user, folder_uuid)
        # Converted before anything is written, so bad Markdown leaves no empty note behind.
        body = _fitting(markdown_to_document(markdown)) if markdown and trim_ascii(markdown) else None
        request = WriteNoteRequest(title=title, body=body, folder_id=folder_uuid, tag_names=_given(tag_names))
        return self._saved(user, self._notes_service.write(user, request).uuid)

    def update(
        self,
        user: User,
        note_uuid: UUID,
        version: int,
        *,
        title: str | None,
        markdown: str | None,
        mode: NoteBodyMode,
    ) -> McpSavedNoteResource:
        """A title change needs no version: only a body save can lose a race."""
        if title is None and markdown is None:
            raise DomainValidationError(messages.MCP_NOTHING_TO_CHANGE)
        note = self._writable(user, note_uuid)
        changes: dict[str, object] = {} if title is None else {"title": title}
        if markdown is not None:
            changes |= {"body": _fitting(_spliced(note.body, markdown, mode)), "version": version}
        try:
            self._notes_service.update(user, note_uuid, UpdateNoteRequest.model_validate(changes))
        except NoteConflictError as conflict:
            current = conflict.server_copy.model_dump().get("version")
            raise ConflictError(messages.MCP_NOTE_VERSION_CONFLICT.format(version=current)) from None
        return self._saved(user, note_uuid)

    def move(self, user: User, note_uuid: UUID, folder_uuid: UUID | None) -> McpNoteSummaryResource:
        self._writable(user, note_uuid)
        self._folder_id(user, folder_uuid)
        self._notes_service.update(user, note_uuid, UpdateNoteRequest(folder_id=folder_uuid))
        return self._summary(user, note_uuid)

    def set_starred(self, user: User, note_uuid: UUID, starred: bool) -> McpNoteSummaryResource:
        self._writable(user, note_uuid)
        self._notes_service.update(user, note_uuid, UpdateNoteRequest(is_starred=starred))
        return self._summary(user, note_uuid)

    def duplicate(self, user: User, note_uuid: UUID) -> McpSavedNoteResource:
        self._writable(user, note_uuid)
        return self._saved(user, self._notes_service.duplicate(user, note_uuid).uuid)

    def change_tags(
        self, user: User, note_uuid: UUID, tag_names: list[str], combine: TagCombiner
    ) -> McpNoteSummaryResource:
        note = self._writable(user, note_uuid)
        names = combine([tag.name for tag in note.tags], _given(tag_names))
        if len(names) > NOTE_TAG_NAMES_MAX:
            raise DomainValidationError(messages.MCP_TOO_MANY_TAGS.format(maximum=NOTE_TAG_NAMES_MAX))
        self._notes_service.set_tags(user, note_uuid, SetNoteTagsRequest(names=names))
        return self._summary(user, note_uuid)

    # ── Lookups ─────────────────────────────────────────────────────────────

    def _readable(self, user: User, note_uuid: UUID) -> Note:
        """Notes in the Trash are invisible to reads."""
        note = self._notes.find_of_user(user.id, note_uuid)
        if note is None or note.deleted_at is not None:
            raise NotFoundError(messages.MCP_NOTE_NOT_FOUND)
        return note

    def _writable(self, user: User, note_uuid: UUID) -> Note:
        """A write that reaches a note in the Trash is told why it cannot proceed."""
        note = self._notes.find_of_user(user.id, note_uuid)
        if note is None:
            raise NotFoundError(messages.MCP_NOTE_NOT_FOUND)
        if note.deleted_at is not None:
            raise DomainValidationError(messages.MCP_NOTE_IN_TRASH)
        return note

    def _folder_id(self, user: User, folder_uuid: UUID | None) -> int | None:
        if folder_uuid is None:
            return None
        folder = self._folders.find_of_user(user.id, folder_uuid)
        if folder is None:
            raise NotFoundError(messages.MCP_FOLDER_NOT_FOUND)
        return folder.id

    def _paths(self, user: User) -> FolderPaths:
        return FolderPaths(self._folders.all_of_user(user.id))

    def _loaded(self, user: User, note_uuid: UUID) -> Note:
        note = self._notes.find_of_user(user.id, note_uuid)
        if note is None:
            raise NotFoundError(messages.MCP_NOTE_NOT_FOUND)
        return self._notes.load(note.id)

    def _summary(self, user: User, note_uuid: UUID) -> McpNoteSummaryResource:
        note = self._loaded(user, note_uuid)
        return McpNoteSummaryResource.from_model(note, self._paths(user).path(note.folder_id))

    def _saved(self, user: User, note_uuid: UUID) -> McpSavedNoteResource:
        note = self._loaded(user, note_uuid)
        return McpSavedNoteResource.from_saved(note, self._paths(user).path(note.folder_id))


def add_tag_names(current: list[str], given: list[str]) -> list[str]:
    """The note's tags plus the given ones it does not have yet."""
    have = {slugify(name) for name in current}
    return [*current, *(name for name in given if slugify(name) not in have)]


def remove_tag_names(current: list[str], given: list[str]) -> list[str]:
    drop = {slugify(name) for name in given}
    return [name for name in current if slugify(name) not in drop]


def replace_tag_names(_current: list[str], given: list[str]) -> list[str]:
    return given


def _given(names: list[str]) -> list[str]:
    """Tag names as given, trimmed, without blanks."""
    trimmed = (trim_ascii(name) for name in names)
    return [name for name in trimmed if name]


def _fitting(body: JsonObject) -> JsonObject:
    """The body, if it is within the limits a save from the web app has."""
    error = body_limit_error(body)
    if error is not None:
        raise ContentError(error[1])
    return body


def _spliced(current: JsonObject | None, markdown: str, mode: NoteBodyMode) -> JsonObject:
    """Append and prepend join documents, so the existing content is never rewritten
    through Markdown. Placeholders in the Markdown refer to the images the note has now."""
    existing_doc: JsonObject = current if current is not None else json.loads(EMPTY_DOCUMENT_JSON)
    added = children(markdown_to_document(markdown, existing_doc))
    existing = _without_trailing_empty_paragraphs(children(existing_doc))
    return {"type": "doc", "content": _SPLICES[mode](existing, added)}


def _without_trailing_empty_paragraphs(content: list[JsonValue]) -> list[JsonValue]:
    trimmed = list(content)
    while trimmed and _is_empty_paragraph(trimmed[-1]):
        trimmed.pop()
    return trimmed


def _is_empty_paragraph(node: JsonValue) -> bool:
    return isinstance(node, dict) and node_type(node) == "paragraph" and is_blank(node.get("content"))


# The existing content and the added content, in the order each mode puts them.
_SPLICES: dict[NoteBodyMode, Callable[[list[JsonValue], list[JsonValue]], list[JsonValue]]] = {
    NoteBodyMode.REPLACE: lambda _existing, added: list(added),
    NoteBodyMode.APPEND: lambda existing, added: [*existing, *added],
    NoteBodyMode.PREPEND: lambda existing, added: [*added, *existing],
}
