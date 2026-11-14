"""Checks the app runs once before it serves anything."""

from app.repositories.user_repository import UserRepository

EMPTY_DATABASE_MESSAGE = (
    "The database has no users. Refusing to start, so a deploy pointed at the wrong or an "
    "unmigrated database never serves an empty app. Set ALLOW_EMPTY_DATABASE=true for a new installation."
)


class EmptyDatabaseError(RuntimeError):
    pass


def ensure_database_has_users(users: UserRepository, allow_empty_database: bool) -> None:
    if allow_empty_database or users.any_exist():
        return
    raise EmptyDatabaseError(EMPTY_DATABASE_MESSAGE)
