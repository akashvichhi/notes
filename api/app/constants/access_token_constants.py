from enum import StrEnum
from typing import Literal

ACCESS_TOKEN_NAME_MAX_LENGTH = 60
# Token text is "{id}|notes_pat_{secret}". The prefix lets secret scanners recognise a
# leaked token; imported tokens already have it.
ACCESS_TOKEN_PREFIX = "notes_pat_"  # noqa: S105 - a format marker, not a secret
ACCESS_TOKEN_ID_SEPARATOR = "|"  # noqa: S105 - a format marker, not a secret
ACCESS_TOKEN_SECRET_BYTES = 32
# Ids are a Postgres bigint; a longer id in a token text cannot exist.
ACCESS_TOKEN_ID_MAX_DIGITS = 18
ACTIVE_ACCESS_TOKENS_MAX = 20
ACCESS_TOKEN_CREATES_PER_MINUTE = 10
type AccessTokenExpiryDays = Literal[30, 90, 365]


class TokenAbility(StrEnum):
    """What a token may do through MCP. Write always comes with read."""

    READ = "notes:read"
    WRITE = "notes:write"
