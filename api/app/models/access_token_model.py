from datetime import datetime

from sqlalchemy import CHAR, DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.constants.access_token_constants import ACCESS_TOKEN_NAME_MAX_LENGTH
from app.constants.security_constants import SHA256_HEX_LENGTH
from app.models.base_model import Base, IdMixin, TimestampMixin


class AccessToken(IdMixin, TimestampMixin, Base):
    """A personal access token for an MCP client. The token text is "{id}|{secret}";
    only the SHA-256 of the secret is stored."""

    __tablename__ = "access_tokens"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(ACCESS_TOKEN_NAME_MAX_LENGTH))
    token_hash: Mapped[str] = mapped_column(CHAR(SHA256_HEX_LENGTH), unique=True)
    abilities: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default=text("'[]'::jsonb"))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
