from sqlalchemy import CHAR, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.constants.database_constants import CASE_INSENSITIVE_COLLATION
from app.constants.folder_constants import FOLDER_COLOR_LENGTH, FOLDER_NAME_MAX_LENGTH
from app.models.base_model import Base, IdMixin, TimestampMixin, UuidMixin


class Folder(IdMixin, UuidMixin, TimestampMixin, Base):
    __tablename__ = "folders"
    __table_args__ = (
        # NULLS NOT DISTINCT: two root folders (parent_id NULL) with the same name clash too.
        UniqueConstraint("user_id", "parent_id", "name", postgresql_nulls_not_distinct=True),
        Index("ix_folders_user_id_parent_id", "user_id", "parent_id"),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # Deferred: deleting a folder removes it first, then moves its children up, so a child
    # may take the deleted folder's own name (services/folder_service.py).
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("folders.id", deferrable=True, initially="DEFERRED"), index=True
    )
    name: Mapped[str] = mapped_column(String(FOLDER_NAME_MAX_LENGTH, collation=CASE_INSENSITIVE_COLLATION))
    color: Mapped[str | None] = mapped_column(CHAR(FOLDER_COLOR_LENGTH))
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
