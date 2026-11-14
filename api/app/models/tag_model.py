from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.constants.database_constants import CASE_INSENSITIVE_COLLATION
from app.constants.tag_constants import TAG_NAME_MAX_LENGTH
from app.models.base_model import Base, IdMixin, TimestampMixin, UuidMixin


class Tag(IdMixin, UuidMixin, TimestampMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "slug"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(TAG_NAME_MAX_LENGTH, collation=CASE_INSENSITIVE_COLLATION))
    slug: Mapped[str] = mapped_column(String(TAG_NAME_MAX_LENGTH, collation=CASE_INSENSITIVE_COLLATION))
