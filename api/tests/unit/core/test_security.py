from app.core.security import PasswordHasher, hash_token, new_session_token

# Hashes made by the previous API (PHP's password_hash, bcrypt, cost 4 to keep tests fast).
LEGACY_HASH_OF_PASSWORD = "$2y$04$HkBHQP..Y6zP0iF4a.FtSO6q7.1bH2U1VtXNeRYu4d4zG3O/29VHG"
LEGACY_HASH_OF_72_AS = "$2y$04$RgjwbjSTOd3lluTIDZKcuOsERByy3To9Nv2NP4jkte9EjTlwB3IKS"


def test_hashed_password_verifies_and_a_wrong_one_does_not() -> None:
    hasher = PasswordHasher()
    password_hash = hasher.hash("correct horse")

    assert password_hash.startswith("$argon2id$")
    assert hasher.verify(password_hash, "correct horse")
    assert not hasher.verify(password_hash, "wrong horse")


def test_legacy_bcrypt_hash_from_the_previous_api_verifies() -> None:
    hasher = PasswordHasher()

    assert hasher.verify(LEGACY_HASH_OF_PASSWORD, "password")
    assert not hasher.verify(LEGACY_HASH_OF_PASSWORD, "Password")


def test_legacy_bcrypt_ignores_bytes_after_72_like_php_did() -> None:
    assert PasswordHasher().verify(LEGACY_HASH_OF_72_AS, "a" * 72 + "anything after is ignored")


def test_legacy_and_outdated_hashes_need_a_rehash() -> None:
    hasher = PasswordHasher()

    assert hasher.needs_rehash(LEGACY_HASH_OF_PASSWORD)
    assert not hasher.needs_rehash(hasher.hash("password"))


def test_unreadable_hash_never_verifies() -> None:
    assert not PasswordHasher().verify("not-a-hash", "password")


def test_session_tokens_are_random_and_only_their_hash_is_kept() -> None:
    first, second = new_session_token(), new_session_token()

    assert first != second
    assert len(hash_token(first)) == 64
    assert hash_token(first) == hash_token(first)
    assert hash_token(first) != first
