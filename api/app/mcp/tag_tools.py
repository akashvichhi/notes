"""Tools that list, create and rename tags. Nothing here deletes a tag."""

from typing import Annotated

from mcp.server.mcpserver import Context, MCPServer
from pydantic import Field

from app.constants.access_token_constants import TokenAbility
from app.mcp.mcp_tool_runner import McpToolRunner
from app.mcp.tool_arguments import READS, SETS, WRITES, TagId
from app.schemas.common.field_types import TagName
from app.schemas.requests.tag_request import CreateTagRequest, RenameTagRequest
from app.schemas.resources.mcp_tag_resource import McpTagListResource, McpTagResource


def register_tag_tools(server: MCPServer, runner: McpToolRunner) -> None:
    @server.tool(
        name="list_tags",
        description="All tags, with id, name, slug and the number of notes that carry each.",
        annotations=READS,
    )
    async def list_tags(ctx: Context) -> McpTagListResource:
        return await runner.run(ctx, TokenAbility.READ, lambda call: call.tags.all(call.user))

    @server.tool(
        name="create_tag",
        description="Create a tag without putting it on a note. (create_note, set_note_tags and "
        "add_note_tags create missing tags on their own.)",
        annotations=WRITES,
    )
    async def create_tag(
        name: Annotated[TagName, Field(description="The tag name.")], ctx: Context
    ) -> McpTagResource:
        request = CreateTagRequest(name=name)
        return await runner.run(ctx, TokenAbility.WRITE, lambda call: call.tags.create(call.user, request))

    @server.tool(name="rename_tag", description="Rename a tag everywhere it is used.", annotations=SETS)
    async def rename_tag(
        id: TagId,
        name: Annotated[TagName, Field(description="The new name.")],
        ctx: Context,
    ) -> McpTagResource:
        request = RenameTagRequest(name=name)
        return await runner.run(
            ctx, TokenAbility.WRITE, lambda call: call.tags.rename(call.user, id, request)
        )
