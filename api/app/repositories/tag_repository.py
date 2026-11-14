from collections.abc import Mapping
from uuid import UUID, uuid7

from sqlalchemy import exists, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.tag_model import Tag


class TagRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_by_uuid(self, tag_uuid: UUID) -> Tag | None:
        """Any owner's tag: only for telling a reused uuid apart from a free one."""
        return self._session.scalar(select(Tag).where(Tag.uuid == tag_uuid))

    def all_of_user(self, user_id: int) -> list[Tag]:
        return list(
            self._session.scalars(select(Tag).where(Tag.user_id == user_id).order_by(Tag.name, Tag.id))
        )

    def find_by_name_prefix(self, user_id: int, prefix: str, limit: int) -> list[Tag]:
        # The name's collation makes this ignore case and accents; autoescape keeps % and _
        # in the prefix literal.
        return list(
            self._session.scalars(
                select(Tag)
                .where(Tag.user_id == user_id, Tag.name.startswith(prefix, autoescape=True))
                .order_by(Tag.name, Tag.id)
                .limit(limit)
            )
        )

    def find_of_user(self, user_id: int, tag_uuid: UUID) -> Tag | None:
        return self._session.scalar(select(Tag).where(Tag.user_id == user_id, Tag.uuid == tag_uuid))

    def slug_taken(self, user_id: int, slug: str, exclude_id: int | None = None) -> bool:
        conditions = [Tag.user_id == user_id, Tag.slug == slug]
        if exclude_id is not None:
            conditions.append(Tag.id != exclude_id)
        return bool(self._session.scalar(select(exists().where(*conditions))))

    def find_by_slugs(self, user_id: int, slugs: list[str]) -> list[Tag]:
        if not slugs:
            return []
        return list(self._session.scalars(select(Tag).where(Tag.user_id == user_id, Tag.slug.in_(slugs))))

    def insert_missing(self, user_id: int, names_by_slug: Mapping[str, str]) -> None:
        """Creates the tags whose slug the user has no tag for yet. ON CONFLICT DO NOTHING,
        so two requests adding the same new tag at once both succeed."""
        if not names_by_slug:
            return
        rows = [
            {"uuid": uuid7(), "user_id": user_id, "slug": slug, "name": name}
            for slug, name in names_by_slug.items()
        ]
        self._session.execute(
            insert(Tag).values(rows).on_conflict_do_nothing(index_elements=[Tag.user_id, Tag.slug])
        )

    def add(self, tag: Tag) -> Tag:
        self._session.add(tag)
        self._session.flush()
        return tag

    def delete(self, tag: Tag) -> None:
        # The note_tag rows go with it (ON DELETE CASCADE); the notes stay.
        self._session.delete(tag)
        self._session.flush()
