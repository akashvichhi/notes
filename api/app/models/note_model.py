from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.constants.database_constants import CASE_INSENSITIVE_COLLATION, SEARCH_TEXT_CONFIG
from app.constants.note_constants import (
    EMPTY_DOCUMENT_JSON,
    NOTE_EXCERPT_COLUMN_LENGTH,
    NOTE_TITLE_MAX_LENGTH,
)
from app.models.base_model import Base, IdMixin, TimestampMixin, UuidMixin
from app.schemas.common.json_types import JsonObject

# Title and text in one vector, so a search term can match either.
SEARCH_VECTOR_EXPRESSION = (
    f"to_tsvector('{SEARCH_TEXT_CONFIG}', coalesce(title, '') || ' ' || coalesce(plain_text, ''))"
)


class Note(IdMixin, UuidMixin, TimestampMixin, Base):
    __tablename__ = "notes"
    __table_args__ = (
        Index("ix_notes_user_id_deleted_at_updated_at", "user_id", "deleted_at", "updated_at"),
        Index("ix_notes_user_id_folder_id_deleted_at", "user_id", "folder_id", "deleted_at"),
        Index("ix_notes_user_id_is_starred_deleted_at", "user_id", "is_starred", "deleted_at"),
        Index("ix_notes_search_vector", "search_vector", postgresql_using="gin"),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    folder_id: Mapped[int | None] = mapped_column(ForeignKey("folders.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(
        String(NOTE_TITLE_MAX_LENGTH, collation=CASE_INSENSITIVE_COLLATION), default="", server_default=""
    )
    # Set once the user types a title, so it stops following the first line.
    title_locked: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    # json, not jsonb: jsonb reorders keys, and the body must come back exactly as saved.
    body: Mapped[JsonObject] = mapped_column(JSON, server_default=text(f"'{EMPTY_DOCUMENT_JSON}'::json"))
    plain_text: Mapped[str] = mapped_column(Text, default="", server_default="")
    excerpt: Mapped[str] = mapped_column(String(NOTE_EXCERPT_COLUMN_LENGTH), default="", server_default="")
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    word_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Set when the note is moved to Trash. Every query goes through note_repository's scope.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR, Computed(SEARCH_VECTOR_EXPRESSION, persisted=True), deferred=True
    )


note_tag = Table(
    "note_tag",
    Base.metadata,
    Column("note_id", ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True, index=True),
)
