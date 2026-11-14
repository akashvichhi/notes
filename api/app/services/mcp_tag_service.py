"""Tags for the MCP tools. Changes go through TagService, so the slug rules are the web
app's."""

from uuid import UUID

from app.constants import messages
from app.core.exceptions import NotFoundError
from app.models.user_model import User
from app.repositories.note_repository import NoteRepository
from app.repositories.tag_repository import TagRepository
from app.schemas.requests.tag_request import CreateTagRequest, RenameTagRequest
from app.schemas.resources.mcp_tag_resource import McpTagCountResource, McpTagListResource, McpTagResource
from app.services.tag_service import TagService


class McpTagService:
    def __init__(self, tag_service: TagService, tags: TagRepository, notes: NoteRepository) -> None:
        self._tag_service = tag_service
        self._tags = tags
        self._notes = notes

    def all(self, user: User) -> McpTagListResource:
        # One grouped count, as the bootstrap does: notes in the Trash do not count.
        counts = self._notes.active_counts_by_tag(user.id)
        return McpTagListResource(
            tags=[
                McpTagCountResource.from_model(tag, counts.get(tag.id, 0))
                for tag in self._tags.all_of_user(user.id)
            ]
        )

    def create(self, user: User, request: CreateTagRequest) -> McpTagResource:
        return McpTagResource.from_resource(self._tag_service.create(user, request).resource)

    def rename(self, user: User, tag_uuid: UUID, request: RenameTagRequest) -> McpTagResource:
        if self._tags.find_of_user(user.id, tag_uuid) is None:
            raise NotFoundError(messages.MCP_TAG_NOT_FOUND)
        return McpTagResource.from_resource(self._tag_service.rename(user, tag_uuid, request))
