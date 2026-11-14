from sqlalchemy import String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.constants.database_constants import CASE_INSENSITIVE_COLLATION
from app.constants.user_constants import (
    PASSWORD_HASH_COLUMN_LENGTH,
    USER_EMAIL_MAX_LENGTH,
    USER_NAME_COLUMN_LENGTH,
)
from app.models.base_model import Base, IdMixin, TimestampMixin, UuidMixin


class User(IdMixin, UuidMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(USER_NAME_COLUMN_LENGTH))
    email: Mapped[str] = mapped_column(
        String(USER_EMAIL_MAX_LENGTH, collation=CASE_INSENSITIVE_COLLATION), unique=True
    )
    password_hash: Mapped[str] = mapped_column(String(PASSWORD_HASH_COLUMN_LENGTH))
    # Display settings the web app owns (theme, sort, ...); merged key by key on update.
    preferences: Mapped[dict[str, str | bool]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
