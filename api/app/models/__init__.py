"""Importing this package registers every table on Base.metadata (Alembic and tests rely on it)."""

from app.models.access_token_model import AccessToken
from app.models.base_model import Base
from app.models.folder_model import Folder
from app.models.note_model import Note, note_tag
from app.models.tag_model import Tag
from app.models.user_model import User
from app.models.user_session_model import UserSession

__all__ = ["AccessToken", "Base", "Folder", "Note", "Tag", "User", "UserSession", "note_tag"]
