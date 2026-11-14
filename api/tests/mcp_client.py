"""Calls the MCP endpoint the way an assistant's client does: JSON-RPC over HTTP POST with a
personal access token as the Bearer token."""

import json
from dataclasses import dataclass
from datetime import datetime
from itertools import count

import httpx2
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_token
from app.models.access_token_model import AccessToken
from app.models.user_model import User

MCP_PATH = "/mcp"
PROTOCOL_VERSION = "2025-06-18"
READ = "notes:read"
WRITE = "notes:write"

_secrets = count(1)


def issue_token(
    session: Session,
    user: User,
    *,
    abilities: list[str] | None = None,
    expires_at: datetime | None = None,
) -> str:
    """A working token text, "{id}|{secret}", for a new token of the user."""
    secret = f"notes_pat_test{next(_secrets)}"
    token = AccessToken(
        user_id=user.id,
        name="Claude",
        token_hash=hash_token(secret),
        abilities=[READ, WRITE] if abilities is None else abilities,
        expires_at=expires_at,
    )
    session.add(token)
    session.flush()
    return f"{token.id}|{secret}"


@dataclass(frozen=True)
class ToolResult:
    is_error: bool
    text: str
    data: dict[str, object]


class McpClient:
    def __init__(self, client: TestClient, token: str | None) -> None:
        self._client = client
        self._token = token
        self._ids = count(1)

    def post(self, method: str, params: dict[str, object] | None = None) -> httpx2.Response:
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": PROTOCOL_VERSION,
        }
        if self._token is not None:
            headers["Authorization"] = f"Bearer {self._token}"
        payload: dict[str, object] = {"jsonrpc": "2.0", "id": next(self._ids), "method": method}
        if params is not None:
            payload["params"] = params
        return self._client.post(MCP_PATH, content=json.dumps(payload), headers=headers)

    def result(self, method: str, params: dict[str, object] | None = None) -> dict[str, object]:
        response = self.post(method, params)
        assert response.status_code == 200, response.text
        body = response.json()
        assert "result" in body, body
        result: dict[str, object] = body["result"]
        return result

    def call(self, tool: str, /, **arguments: object) -> ToolResult:
        result = self.result("tools/call", {"name": tool, "arguments": arguments})
        content = result["content"]
        assert isinstance(content, list)
        text = "".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
        data = result.get("structuredContent")
        return ToolResult(
            is_error=bool(result.get("isError")), text=text, data=data if isinstance(data, dict) else {}
        )

    def ok(self, tool: str, /, **arguments: object) -> dict[str, object]:
        """The tool's data, after checking it did not fail."""
        result = self.call(tool, **arguments)
        assert not result.is_error, result.text
        return result.data

    def error(self, tool: str, /, **arguments: object) -> str:
        """The tool's error text, after checking it failed."""
        result = self.call(tool, **arguments)
        assert result.is_error, result.data
        return result.text
