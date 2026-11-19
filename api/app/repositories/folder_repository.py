from uuid import UUID

from sqlalchemy import delete, exists, select, text
from sqlalchemy.orm import Session

from app.models.folder_model import Folder


class FolderRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_by_uuid(self, folder_uuid: UUID) -> Folder | None:
        """Any owner's folder: only for telling a reused uuid apart from a free one."""
        return self._session.scalar(select(Folder).where(Folder.uuid == folder_uuid))

    def all_of_user(self, user_id: int) -> list[Folder]:
        return list(
            self._session.scalars(
                select(Folder)
                .where(Folder.user_id == user_id)
                .order_by(Folder.position, Folder.name, Folder.id)
            )
        )

    def find_by_name_prefix(self, user_id: int, prefix: str, limit: int) -> list[Folder]:
        # The name's collation makes this ignore case and accents; autoescape keeps % and _
        # in the prefix literal.
        return list(
            self._session.scalars(
                select(Folder)
                .where(Folder.user_id == user_id, Folder.name.startswith(prefix, autoescape=True))
                .order_by(Folder.name, Folder.id)
                .limit(limit)
            )
        )

    def find_of_user(self, user_id: int, folder_uuid: UUID) -> Folder | None:
        return self._session.scalar(
            select(Folder).where(Folder.user_id == user_id, Folder.uuid == folder_uuid)
        )

    def uuid_of(self, folder_id: int | None) -> UUID | None:
        if folder_id is None:
            return None
        return self._session.scalar(select(Folder.uuid).where(Folder.id == folder_id))

    def name_taken(
        self, user_id: int, parent_id: int | None, name: str, exclude_id: int | None = None
    ) -> bool:
        # The name column's collation ignores case and accents, like the unique constraint.
        conditions = [
            Folder.user_id == user_id,
            Folder.parent_id.is_not_distinct_from(parent_id),
            Folder.name == name,
        ]
        if exclude_id is not None:
            conditions.append(Folder.id != exclude_id)
        return bool(self._session.scalar(select(exists().where(*conditions))))

    def children_of(self, folder_id: int) -> list[Folder]:
        return list(
            self._session.scalars(select(Folder).where(Folder.parent_id == folder_id).order_by(Folder.id))
        )

    def add(self, folder: Folder) -> Folder:
        self._session.add(folder)
        self._session.flush()
        return folder

    def delete(self, folder: Folder) -> None:
        self._session.delete(folder)
        self._session.flush()

    def delete_all_of_user(self, user_id: int) -> None:
        self._session.execute(delete(Folder).where(Folder.user_id == user_id))

    def flush(self) -> None:
        self._session.flush()

    def check_deferred_constraints(self) -> None:
        """Checks the deferred parent key now, inside the request, not only at commit."""
        self._session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
