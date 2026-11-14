"""Tags: one per slug per user, so "Side Projects" and "side_projects" are the same tag."""

from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants import messages
from app.content.slug import slugify
from app.core.exceptions import ConflictError, NotFoundError
from app.models.tag_model import Tag
from app.models.user_model import User
from app.repositories.tag_repository import TagRepository
from app.schemas.requests.tag_request import CreateTagRequest, RenameTagRequest
from app.schemas.resources.tag_resource import TagResource
from app.services.create_result import CreateResult


class TagService:
    def __init__(self, db: Session, tags: TagRepository) -> None:
        self._db = db
        self._tags = tags

    def create(self, user: User, request: CreateTagRequest) -> CreateResult[TagResource]:
        if request.uuid is not None:
            existing = self._tags.find_by_uuid(request.uuid)
            if existing is not None:
                if existing.user_id != user.id:
                    raise ConflictError
                return CreateResult(TagResource.from_model(existing), created=False)
        slug = slugify(request.name)
        self._ensure_slug_is_free(user.id, slug)
        tag = Tag(user_id=user.id, name=request.name, slug=slug)
        if request.uuid is not None:
            tag.uuid = request.uuid
        self._tags.add(tag)
        self._commit()
        return CreateResult(TagResource.from_model(tag), created=True)

    def rename(self, user: User, tag_uuid: UUID, request: RenameTagRequest) -> TagResource:
        tag = self._get(user, tag_uuid)
        slug = slugify(request.name)
        self._ensure_slug_is_free(user.id, slug, exclude_id=tag.id)
        tag.name = request.name
        tag.slug = slug
        self._commit()
        return TagResource.from_model(tag)

    def delete(self, user: User, tag_uuid: UUID) -> None:
        self._tags.delete(self._get(user, tag_uuid))
        self._db.commit()

    def resolve_names(self, user: User, names: list[str]) -> list[Tag]:
        """The user's tags for these names, creating the missing ones. Names that share a
        slug are one tag, named after the first; names with no slug are skipped. Does not
        commit: the caller's transaction does."""
        names_by_slug: dict[str, str] = {}
        for name in names:
            slug = slugify(name)
            if slug:
                names_by_slug.setdefault(slug, name)
        self._tags.insert_missing(user.id, names_by_slug)
        return self._tags.find_by_slugs(user.id, list(names_by_slug))

    def _get(self, user: User, tag_uuid: UUID) -> Tag:
        tag = self._tags.find_of_user(user.id, tag_uuid)
        if tag is None:
            raise NotFoundError
        return tag

    def _ensure_slug_is_free(self, user_id: int, slug: str, exclude_id: int | None = None) -> None:
        if self._tags.slug_taken(user_id, slug, exclude_id):
            raise ConflictError.for_field("name", messages.NAME_TAKEN)

    def _commit(self) -> None:
        try:
            self._db.commit()
        except IntegrityError:
            # A concurrent request took the slug or uuid between the check and the write.
            self._db.rollback()
            raise ConflictError from None
