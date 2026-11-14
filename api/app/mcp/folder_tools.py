"""Tools that show and change the folder tree. Nothing here deletes a folder."""

from typing import Annotated
from uuid import UUID

from mcp.server.mcpserver import Context, MCPServer
from pydantic import Field

from app.constants.access_token_constants import TokenAbility
from app.mcp.mcp_tool_runner import McpToolRunner
from app.mcp.tool_arguments import READS, SETS, WRITES, FolderColor, FolderId
from app.schemas.common.field_types import FolderName, FolderPosition
from app.schemas.requests.folder_request import CreateFolderRequest, UpdateFolderRequest
from app.schemas.resources.mcp_folder_resource import McpFolderResource, McpFolderTreeResource


def register_folder_tools(server: MCPServer, runner: McpToolRunner) -> None:
    @server.tool(
        name="list_folders",
        description="The folder tree: each folder with its id, name, colour, position among its "
        "siblings, the number of notes directly in it, and its child folders.",
        annotations=READS,
    )
    async def list_folders(ctx: Context) -> McpFolderTreeResource:
        return await runner.run(ctx, TokenAbility.READ, lambda call: call.folders.tree(call.user))

    @server.tool(
        name="create_folder",
        description="Create a folder, at the top level or inside another folder. Names must be unique "
        "among siblings.",
        annotations=WRITES,
    )
    async def create_folder(
        name: Annotated[FolderName, Field(description="The folder name.")],
        ctx: Context,
        parent_id: Annotated[
            UUID | None,
            Field(description="Parent folder id from list_folders. Omit for a top-level folder."),
        ] = None,
        color: FolderColor | None = None,
    ) -> McpFolderResource:
        request = CreateFolderRequest(name=name, parent_uuid=parent_id, color=color)
        return await runner.run(ctx, TokenAbility.WRITE, lambda call: call.folders.create(call.user, request))

    @server.tool(
        name="rename_folder",
        description="Rename a folder. Names must be unique among siblings.",
        annotations=SETS,
    )
    async def rename_folder(
        id: FolderId,
        name: Annotated[FolderName, Field(description="The new name.")],
        ctx: Context,
    ) -> McpFolderResource:
        request = UpdateFolderRequest(name=name)
        return await runner.run(
            ctx, TokenAbility.WRITE, lambda call: call.folders.update(call.user, id, request)
        )

    @server.tool(
        name="set_folder_color",
        description="Set a folder's colour as #rrggbb, or clear it with null.",
        annotations=SETS,
    )
    async def set_folder_color(
        id: FolderId,
        color: Annotated[FolderColor | None, Field(description="Colour as #rrggbb, or null for none.")],
        ctx: Context,
    ) -> McpFolderResource:
        request = UpdateFolderRequest(color=color)
        return await runner.run(
            ctx, TokenAbility.WRITE, lambda call: call.folders.update(call.user, id, request)
        )

    @server.tool(
        name="reorder_folder",
        description="Set a folder's position among its siblings. Folders are shown in ascending "
        "position, then by name; list_folders shows the current positions.",
        annotations=SETS,
    )
    async def reorder_folder(
        id: FolderId,
        position: Annotated[FolderPosition, Field(description="The new position.")],
        ctx: Context,
    ) -> McpFolderResource:
        request = UpdateFolderRequest(position=position)
        return await runner.run(
            ctx, TokenAbility.WRITE, lambda call: call.folders.update(call.user, id, request)
        )
