from datetime import datetime

from sqlalchemy import CHAR, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.constants.security_constants import SHA256_HEX_LENGTH
from app.models.base_model import Base, IdMixin


class UserSession(IdMixin, Base):
    """A browser sign-in. Only the SHA-256 of the cookie's random id is stored."""

    __tablename__ = "sessions"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(CHAR(SHA256_HEX_LENGTH), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
