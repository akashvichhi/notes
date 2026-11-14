"""Password hashing and the random secrets behind sessions and access tokens. Passwords
are never logged or returned."""

import hashlib
import secrets

import bcrypt
from argon2 import PasswordHasher as Argon2Hasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.constants.access_token_constants import ACCESS_TOKEN_PREFIX, ACCESS_TOKEN_SECRET_BYTES

SESSION_TOKEN_BYTES = 32
# Imported accounts carry bcrypt hashes, mostly in the "$2y$" variant, made by a hasher
# that read only the first 72 bytes. The bcrypt library writes "$2b$" (the same
# algorithm) and rejects longer input.
LEGACY_BCRYPT_PREFIXES = ("$2y$", "$2b$", "$2a$")
BCRYPT_2Y_PREFIX = "$2y$"
BCRYPT_PREFIX = "$2b$"
BCRYPT_MAX_PASSWORD_BYTES = 72
TEXT_ENCODING = "utf-8"


class PasswordHasher:
    def __init__(self) -> None:
        self._argon2 = Argon2Hasher()
        self._unusable_hash = self._argon2.hash(new_session_token())

    def hash(self, password: str) -> str:
        return self._argon2.hash(password)

    def verify(self, password_hash: str, password: str) -> bool:
        if password_hash.startswith(LEGACY_BCRYPT_PREFIXES):
            return self._verify_legacy_bcrypt(password_hash, password)
        try:
            return self._argon2.verify(password_hash, password)
        except VerificationError, InvalidHashError:
            return False

    def verify_nothing(self, password: str) -> None:
        """Costs as much as a real check; for sign-ins with an unknown email."""
        self.verify(self._unusable_hash, password)

    def needs_rehash(self, password_hash: str) -> bool:
        if password_hash.startswith(LEGACY_BCRYPT_PREFIXES):
            return True
        return self._argon2.check_needs_rehash(password_hash)

    @staticmethod
    def _verify_legacy_bcrypt(password_hash: str, password: str) -> bool:
        stored = password_hash.replace(BCRYPT_2Y_PREFIX, BCRYPT_PREFIX, 1).encode(TEXT_ENCODING)
        candidate = password.encode(TEXT_ENCODING)[:BCRYPT_MAX_PASSWORD_BYTES]
        try:
            return bcrypt.checkpw(candidate, stored)
        except ValueError:
            return False


def new_session_token() -> str:
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def new_access_token_secret() -> str:
    """The part of a personal access token after "{id}|"; only its hash is stored."""
    return ACCESS_TOKEN_PREFIX + secrets.token_urlsafe(ACCESS_TOKEN_SECRET_BYTES)


def hash_token(token: str) -> str:
    """What the database keeps instead of a session id or access token: its SHA-256."""
    return hashlib.sha256(token.encode(TEXT_ENCODING)).hexdigest()
