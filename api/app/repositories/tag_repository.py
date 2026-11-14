from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.tag_model import Tag


class TagRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_by_uuid(self, tag_uuid: UUID) -> Tag | None:
        """Any owner's tag: only for telling a reused uuid apart from a free one."""
        return self._session.scalar(select(Tag).where(Tag.uuid == tag_uuid))

    def find_of_user(self, user_id: int, tag_uuid: UUID) -> Tag | None:
        return self._session.scalar(select(Tag).where(Tag.user_id == user_id, Tag.uuid == tag_uuid))

    def slug_taken(self, user_id: int, slug: str, exclude_id: int | None = None) -> bool:
        conditions = [Tag.user_id == user_id, Tag.slug == slug]
        if exclude_id is not None:
            conditions.append(Tag.id != exclude_id)
        return bool(self._session.scalar(select(exists().where(*conditions))))

    def add(self, tag: Tag) -> Tag:
        self._session.add(tag)
        self._session.flush()
        return tag

    def delete(self, tag: Tag) -> None:
        # The note_tag rows go with it (ON DELETE CASCADE); the notes stay.
        self._session.delete(tag)
        self._session.flush()
