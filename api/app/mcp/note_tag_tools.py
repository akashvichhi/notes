"""Tools that change which tags a note carries. Tags are given by name; missing ones are
created, and a tag taken off a note still exists."""

from collections.abc import Awaitable, Callable
from uuid import UUID

from mcp.server.mcpserver import Context, MCPServer

from app.constants.access_token_constants import TokenAbility
from app.mcp.mcp_tool_runner import McpToolRunner
from app.mcp.tool_arguments import SETS, NoteUuid, TagNames
from app.schemas.resources.mcp_note_resource import McpNoteSummaryResource
from app.services.mcp_note_service import (
    TagCombiner,
    add_tag_names,
    remove_tag_names,
    replace_tag_names,
)

type TagTool = Callable[[UUID, list[str], Context], Awaitable[McpNoteSummaryResource]]

_TAG_TOOLS: tuple[tuple[str, str, TagCombiner], ...] = (
    (
        "set_note_tags",
        "Replace a note's tags with exactly this list (an empty list clears them). Tags that do not "
        "exist yet are created; tags taken off the note still exist.",
        replace_tag_names,
    ),
    (
        "add_note_tags",
        "Add tags to a note, keeping the ones it has. Tags that do not exist yet are created.",
        add_tag_names,
    ),
    (
        "remove_note_tags",
        "Take tags off a note. This only edits the note: the tags themselves remain and stay on other notes.",
        remove_tag_names,
    ),
)


def register_note_tag_tools(server: MCPServer, runner: McpToolRunner) -> None:
    for name, description, combine in _TAG_TOOLS:
        server.add_tool(_tag_tool(runner, combine), name=name, description=description, annotations=SETS)


def _tag_tool(runner: McpToolRunner, combine: TagCombiner) -> TagTool:
    async def change_note_tags(uuid: NoteUuid, tags: TagNames, ctx: Context) -> McpNoteSummaryResource:
        return await runner.run(
            ctx, TokenAbility.WRITE, lambda call: call.notes.change_tags(call.user, uuid, tags, combine)
        )

    return change_note_tags
