"""The MCP server: every tool group on one server, served over streamable HTTP at /mcp
behind bearer-token authentication."""

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from starlette.datastructures import State
from starlette.types import ASGIApp

from app.constants.mcp_constants import MCP_INSTRUCTIONS, MCP_PATH, MCP_SERVER_NAME, MCP_SERVER_VERSION
from app.mcp.folder_tools import register_folder_tools
from app.mcp.mcp_authentication import McpAuthentication
from app.mcp.mcp_tool_runner import McpToolRunner
from app.mcp.note_tag_tools import register_note_tag_tools
from app.mcp.note_tools import register_note_tools
from app.mcp.tag_tools import register_tag_tools

_TOOL_GROUPS = (register_note_tools, register_note_tag_tools, register_folder_tools, register_tag_tools)


def create_mcp_server(state: State) -> MCPServer:
    server = MCPServer(MCP_SERVER_NAME, instructions=MCP_INSTRUCTIONS, version=MCP_SERVER_VERSION)
    runner = McpToolRunner(state)
    for register in _TOOL_GROUPS:
        register(server, runner)
    return server


def create_mcp_app(server: MCPServer, state: State) -> ASGIApp:
    """Stateless JSON responses: every call carries its token, so no session is kept between
    requests. Requests reach this app through the /mcp route with their full path."""
    app = server.streamable_http_app(
        streamable_http_path=MCP_PATH,
        json_response=True,
        stateless_http=True,
        # Bearer tokens, not cookies, authenticate here, so a rebinding page gains nothing;
        # Caddy decides which host names reach the API.
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    return McpAuthentication(app, state)
