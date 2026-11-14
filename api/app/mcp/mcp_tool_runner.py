"""Runs one tool call: checks the token may do it, opens a database session in a worker
thread, builds the services and turns a domain error into the text the assistant sees."""

from collections.abc import Callable
from dataclasses import dataclass

from mcp.server.mcpserver import Context
from mcp.server.mcpserver.exceptions import ToolError
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import State
from starlette.requests import Request

from app.api.dependencies import get_folder_service, get_note_service, get_tag_service
from app.constants import messages
from app.constants.access_token_constants import TokenAbility
from app.constants.mcp_constants import MCP_PRINCIPAL_STATE_KEY
from app.content.content_error import ContentError
from app.core.clock import Clock
from app.core.exceptions import DomainError
from app.models.user_model import User
from app.repositories.folder_repository import FolderRepository
from app.repositories.note_repository import NoteRepository
from app.repositories.tag_repository import TagRepository
from app.repositories.user_repository import UserRepository
from app.services.access_token_service import AuthenticatedToken
from app.services.mcp_folder_service import McpFolderService
from app.services.mcp_note_service import McpNoteService
from app.services.mcp_tag_service import McpTagService


@dataclass(frozen=True)
class McpCall:
    """What a tool works with: the token's user and the services, on one session."""

    user: User
    notes: McpNoteService
    folders: McpFolderService
    tags: McpTagService


class McpToolRunner:
    def __init__(self, state: State) -> None:
        """`state` is the API's app state, read on every call (see McpAuthentication)."""
        self._state = state

    async def run[T](self, ctx: Context, ability: TokenAbility, action: Callable[[McpCall], T]) -> T:
        token = _token_of(ctx)
        if not token.can(ability):
            raise ToolError(messages.MCP_ABILITY_MISSING.format(ability=ability.value))
        # In a worker thread: the database driver and the services are synchronous.
        return await run_in_threadpool(self._run, token, action)

    def _run[T](self, token: AuthenticatedToken, action: Callable[[McpCall], T]) -> T:
        session: Session
        with self._state.session_factory() as session:
            call = self._call(session, token)
            try:
                return action(call)
            except DomainError as error:
                raise ToolError(_message_of(error)) from None
            except ContentError as error:
                raise ToolError(str(error)) from None
            except ValidationError:
                # The tool arguments are validated before this, so this is a value the
                # request schemas refuse after the tool combined them; it names no input.
                raise ToolError(messages.VALIDATION_FAILED) from None

    def _call(self, session: Session, token: AuthenticatedToken) -> McpCall:
        user = UserRepository(session).get(token.user_id)
        if user is None:
            raise ToolError(messages.UNAUTHENTICATED)
        clock: Clock = self._state.clock
        tag_service = get_tag_service(session)
        notes = NoteRepository(session)
        folders = FolderRepository(session)
        return McpCall(
            user=user,
            notes=McpNoteService(get_note_service(session, tag_service, clock), notes, folders),
            folders=McpFolderService(get_folder_service(session), folders, notes),
            tags=McpTagService(tag_service, TagRepository(session), notes),
        )


def _token_of(ctx: Context) -> AuthenticatedToken:
    """The token McpAuthentication put in the request state; every request has one."""
    request = ctx.request_context.request
    token = getattr(request.state, MCP_PRINCIPAL_STATE_KEY, None) if isinstance(request, Request) else None
    if not isinstance(token, AuthenticatedToken):
        raise ToolError(messages.UNAUTHENTICATED)
    return token


def _message_of(error: DomainError) -> str:
    """An error about one input says what is wrong with it, not just that something is."""
    return error.details[0].message if error.details else error.message
