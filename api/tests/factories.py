"""Deterministic test-data builders. Each adds a row to the test's session and flushes,
so the row has its id and database defaults without committing."""

from datetime import datetime
from itertools import count

from sqlalchemy.orm import Session

from app.models.access_token_model import AccessToken
from app.models.folder_model import Folder
from app.models.note_model import Note
from app.models.tag_model import Tag
from app.models.user_model import User
from app.schemas.common.json_types import JsonObject

# An Argon2 hash of "password", so factories never spend time hashing.
PASSWORD = "password"
PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$cVWecByRN4B9g9PN29vWlQ$480q0mB25XjA8HGHwntwTr1smNYqH7GYKc5OiqJHXO4"
)

_sequence = count(1)


def make_user(session: Session, *, email: str | None = None, name: str = "Test User") -> User:
    user = User(name=name, email=email or f"user{next(_sequence)}@example.com", password_hash=PASSWORD_HASH)
    session.add(user)
    session.flush()
    return user


def make_folder(
    session: Session, user: User, *, name: str | None = None, parent: Folder | None = None, position: int = 0
) -> Folder:
    folder = Folder(
        user_id=user.id,
        parent_id=parent.id if parent else None,
        name=name or f"Folder {next(_sequence)}",
        position=position,
    )
    session.add(folder)
    session.flush()
    return folder


def make_tag(session: Session, user: User, *, name: str | None = None, slug: str | None = None) -> Tag:
    tag_name = name or f"tag{next(_sequence)}"
    tag = Tag(user_id=user.id, name=tag_name, slug=slug or tag_name.lower())
    session.add(tag)
    session.flush()
    return tag


def make_note(
    session: Session,
    user: User,
    *,
    title: str = "",
    plain_text: str = "",
    body: JsonObject | None = None,
    folder: Folder | None = None,
) -> Note:
    note = Note(
        user_id=user.id,
        folder_id=folder.id if folder else None,
        title=title,
        plain_text=plain_text,
        body=body or {"type": "doc", "content": []},
    )
    session.add(note)
    session.flush()
    return note


def make_access_token(
    session: Session,
    user: User,
    *,
    name: str = "Claude",
    abilities: list[str] | None = None,
    expires_at: datetime | None = None,
) -> AccessToken:
    token = AccessToken(
        user_id=user.id,
        name=name,
        # Unique per row; no test signs in with it.
        token_hash=f"{next(_sequence):064x}",
        abilities=abilities or ["notes:read"],
        expires_at=expires_at,
    )
    session.add(token)
    session.flush()
    return token
