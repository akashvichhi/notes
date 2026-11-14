"""Tools that find, read and write notes."""

from typing import Annotated
from uuid import UUID

from mcp.server.mcpserver import Context, MCPServer
from pydantic import Field

from app.constants.access_token_constants import TokenAbility
from app.constants.mcp_constants import NoteBodyMode
from app.constants.note_constants import NoteSort
from app.constants.pagination_constants import DEFAULT_PAGE, DEFAULT_PER_PAGE, MAX_PER_PAGE
from app.mcp.mcp_tool_runner import McpToolRunner
from app.mcp.tool_arguments import READS, SETS, WRITES, NoteUuid, TagNames
from app.schemas.common.field_types import NoteTitle, SearchQuery, TagFilter
from app.schemas.requests.note_request import NoteListRequest
from app.schemas.resources.mcp_note_resource import (
    McpNoteListResource,
    McpNoteResource,
    McpNoteSummaryResource,
    McpSavedNoteResource,
    McpSearchResultsResource,
)

SearchQueryArgument = Annotated[SearchQuery, Field(description="The words to search for.")]
Markdown = Annotated[
    str,
    Field(
        description="The body, as markdown (see the server instructions for underline, colour, "
        "alignment and so on)."
    ),
]


def register_note_tools(server: MCPServer, runner: McpToolRunner) -> None:
    @server.tool(
        name="search_notes",
        description="Full-text search of note titles and bodies. Returns up to 20 matching notes, most "
        "recently updated first, each with an excerpt around the match. Words of fewer than 3 "
        "characters are ignored.",
        annotations=READS,
    )
    async def search_notes(query: SearchQueryArgument, ctx: Context) -> McpSearchResultsResource:
        return await runner.run(ctx, TokenAbility.READ, lambda call: call.notes.search(call.user, query))

    @server.tool(
        name="list_notes",
        description="List notes, optionally only those in one folder, with one tag, or starred. "
        "Paginated; returns titles and excerpts, not bodies (use get_note for a body). Notes in Trash "
        "are never listed.",
        annotations=READS,
    )
    async def list_notes(
        ctx: Context,
        folder_id: Annotated[
            UUID | None,
            Field(description="Only notes directly in this folder (a folder id from list_folders)."),
        ] = None,
        tag: Annotated[
            TagFilter | None,
            Field(description="Only notes with this tag (its name or slug)."),
        ] = None,
        starred: Annotated[bool, Field(description="true for starred notes only.")] = False,
        sort: Annotated[
            NoteSort,
            Field(description="Order: updated (newest first), created (newest first) or title (A to Z)."),
        ] = NoteSort.UPDATED,
        page: Annotated[int, Field(ge=1, description="Page number, from 1.")] = DEFAULT_PAGE,
        per_page: Annotated[
            int, Field(ge=1, le=MAX_PER_PAGE, description=f"Notes per page, at most {MAX_PER_PAGE}.")
        ] = DEFAULT_PER_PAGE,
    ) -> McpNoteListResource:
        request = NoteListRequest(
            folder_id=folder_id, tag=tag, starred=starred, sort=sort, page=page, per_page=per_page
        )
        return await runner.run(ctx, TokenAbility.READ, lambda call: call.notes.page(call.user, request))

    @server.tool(
        name="get_note",
        description="Read one note: its title, its body as markdown, folder, tags, starred flag and "
        "version. Pasted images appear as ![…](note-image:N) placeholders; keep them exactly as they "
        "are when you write the body back. Pass the version to update_note.",
        annotations=READS,
    )
    async def get_note(uuid: NoteUuid, ctx: Context) -> McpNoteResource:
        return await runner.run(ctx, TokenAbility.READ, lambda call: call.notes.get(call.user, uuid))

    @server.tool(
        name="create_note",
        description="Create a note with a title and optional markdown body, folder and tags. Tags that "
        "do not exist yet are created. Returns the new note.",
        annotations=WRITES,
    )
    async def create_note(
        title: Annotated[NoteTitle, Field(description="The note title.")],
        ctx: Context,
        markdown: Markdown | None = None,
        folder_id: Annotated[
            UUID | None,
            Field(description="Folder to create it in (an id from list_folders). Omit for no folder."),
        ] = None,
        tags: TagNames | None = None,
    ) -> McpSavedNoteResource:
        return await runner.run(
            ctx,
            TokenAbility.WRITE,
            lambda call: call.notes.create(call.user, title, markdown, folder_id, tags or []),
        )

    @server.tool(
        name="update_note",
        description="Change a note's title and/or body. Call get_note first and pass its version. mode "
        '"replace" (default) swaps the whole body for the markdown; "append" adds the markdown at the '
        'end; "prepend" adds it at the start (the rest of the note is untouched). If the note changed '
        "since you read it, this fails: call get_note again and reapply your change.",
        annotations=WRITES,
    )
    async def update_note(
        uuid: NoteUuid,
        version: Annotated[int, Field(ge=1, description="The version get_note returned.")],
        ctx: Context,
        title: Annotated[NoteTitle | None, Field(description="A new title.")] = None,
        markdown: Annotated[
            str | None,
            Field(
                description="The body markdown. With mode replace, keep every note-image:N placeholder "
                "you want to keep."
            ),
        ] = None,
        mode: Annotated[NoteBodyMode, Field(description="How markdown is applied.")] = NoteBodyMode.REPLACE,
    ) -> McpSavedNoteResource:
        return await runner.run(
            ctx,
            TokenAbility.WRITE,
            lambda call: call.notes.update(
                call.user, uuid, version, title=title, markdown=markdown, mode=mode
            ),
        )

    @server.tool(
        name="move_note",
        description="Move a note into a folder, or out of every folder with folder_id null.",
        annotations=SETS,
    )
    async def move_note(
        uuid: NoteUuid,
        folder_id: Annotated[
            UUID | None,
            Field(description="The destination folder id from list_folders, or null for no folder."),
        ],
        ctx: Context,
    ) -> McpNoteSummaryResource:
        return await runner.run(
            ctx, TokenAbility.WRITE, lambda call: call.notes.move(call.user, uuid, folder_id)
        )

    @server.tool(name="set_note_starred", description="Star or unstar a note.", annotations=SETS)
    async def set_note_starred(
        uuid: NoteUuid,
        starred: Annotated[bool, Field(description="true to star, false to unstar.")],
        ctx: Context,
    ) -> McpNoteSummaryResource:
        return await runner.run(
            ctx, TokenAbility.WRITE, lambda call: call.notes.set_starred(call.user, uuid, starred)
        )

    @server.tool(
        name="duplicate_note",
        description='Copy a note (body, folder and tags) into a new note titled "<title> (copy)". '
        "Returns the copy.",
        annotations=WRITES,
    )
    async def duplicate_note(
        uuid: Annotated[UUID, Field(description="The uuid of the note to copy.")], ctx: Context
    ) -> McpSavedNoteResource:
        return await runner.run(ctx, TokenAbility.WRITE, lambda call: call.notes.duplicate(call.user, uuid))
