from datetime import datetime
from uuid import UUID, uuid7

from sqlalchemy import BigInteger, DateTime, Identity, MetaData, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Named constraints, so Alembic migrations can drop and alter them by a stable name.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class IdMixin:
    # BY DEFAULT, not ALWAYS: rows loaded from a backup or an import keep their ids,
    # so tokens ("{id}|...") and references stay valid; reset the sequences afterwards.
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=False), primary_key=True)


class UuidMixin:
    # Time-ordered, so new rows land at the end of the unique index.
    uuid: Mapped[UUID] = mapped_column(Uuid, unique=True, default=uuid7)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
