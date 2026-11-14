"""Create the schema: users, sessions, access tokens, folders, tags, notes.

Revision ID: 0001
Revises:
Create Date: 2026-11-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# A migration is a snapshot: its names, lengths and expressions are written out here
# instead of imported, so a later change to a constant never rewrites past migrations.
CASE_INSENSITIVE_COLLATION = "case_insensitive"
CASE_INSENSITIVE_ICU_LOCALE = "und-u-ks-level1"
SEARCH_VECTOR_EXPRESSION = "to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(plain_text, ''))"

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _id() -> sa.Column[int]:
    return sa.Column("id", sa.BigInteger(), sa.Identity(always=False), primary_key=True)


def _uuid() -> sa.Column[object]:
    return sa.Column("uuid", sa.Uuid(), nullable=False, unique=True)


def _user_id() -> sa.Column[int]:
    return sa.Column(
        "user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )


def _timestamps() -> list[sa.Column[object]]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def _case_insensitive(length: int) -> sa.String:
    return sa.String(length, collation=CASE_INSENSITIVE_COLLATION)


def upgrade() -> None:
    op.execute(
        f"CREATE COLLATION {CASE_INSENSITIVE_COLLATION} "
        f"(provider = icu, locale = '{CASE_INSENSITIVE_ICU_LOCALE}', deterministic = false)"
    )

    op.create_table(
        "users",
        _id(),
        _uuid(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", _case_insensitive(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("preferences", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        *_timestamps(),
    )

    op.create_table(
        "sessions",
        _id(),
        _user_id(),
        sa.Column("token_hash", sa.CHAR(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"])

    op.create_table(
        "access_tokens",
        _id(),
        _user_id(),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("token_hash", sa.CHAR(64), nullable=False, unique=True),
        sa.Column("abilities", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        *_timestamps(),
    )
    op.create_index("ix_access_tokens_user_id", "access_tokens", ["user_id"])
    op.create_index("ix_access_tokens_expires_at", "access_tokens", ["expires_at"])

    op.create_table(
        "folders",
        _id(),
        _uuid(),
        _user_id(),
        sa.Column(
            "parent_id", sa.BigInteger(), sa.ForeignKey("folders.id", deferrable=True, initially="DEFERRED")
        ),
        sa.Column("name", _case_insensitive(120), nullable=False),
        sa.Column("color", sa.CHAR(7)),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("user_id", "parent_id", "name", postgresql_nulls_not_distinct=True),
    )
    op.create_index("ix_folders_parent_id", "folders", ["parent_id"])
    op.create_index("ix_folders_user_id_parent_id", "folders", ["user_id", "parent_id"])

    op.create_table(
        "tags",
        _id(),
        _uuid(),
        _user_id(),
        sa.Column("name", _case_insensitive(60), nullable=False),
        sa.Column("slug", _case_insensitive(60), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("user_id", "slug"),
    )

    op.create_table(
        "notes",
        _id(),
        _uuid(),
        _user_id(),
        sa.Column("folder_id", sa.BigInteger(), sa.ForeignKey("folders.id", ondelete="SET NULL")),
        sa.Column("title", _case_insensitive(255), server_default="", nullable=False),
        sa.Column("title_locked", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "body",
            sa.JSON(),
            server_default=sa.text("""'{"type": "doc", "content": []}'::json"""),
            nullable=False,
        ),
        sa.Column("plain_text", sa.Text(), server_default="", nullable=False),
        sa.Column("excerpt", sa.String(200), server_default="", nullable=False),
        sa.Column("is_starred", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("word_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *_timestamps(),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed(SEARCH_VECTOR_EXPRESSION, persisted=True),
            nullable=False,
        ),
    )
    op.create_index("ix_notes_folder_id", "notes", ["folder_id"])
    op.create_index(
        "ix_notes_user_id_deleted_at_updated_at", "notes", ["user_id", "deleted_at", "updated_at"]
    )
    op.create_index("ix_notes_user_id_folder_id_deleted_at", "notes", ["user_id", "folder_id", "deleted_at"])
    op.create_index(
        "ix_notes_user_id_is_starred_deleted_at", "notes", ["user_id", "is_starred", "deleted_at"]
    )
    op.create_index("ix_notes_search_vector", "notes", ["search_vector"], postgresql_using="gin")

    op.create_table(
        "note_tag",
        sa.Column(
            "note_id", sa.BigInteger(), sa.ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("tag_id", sa.BigInteger(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_note_tag_tag_id", "note_tag", ["tag_id"])


def downgrade() -> None:
    for table in ("note_tag", "notes", "tags", "folders", "access_tokens", "sessions", "users"):
        op.drop_table(table)
    op.execute(f"DROP COLLATION {CASE_INSENSITIVE_COLLATION}")
