"""scrypt password hashes in a self-describing text format: scrypt:n:r:p:salt:hash."""

import base64
import binascii
import hashlib
import hmac
import secrets
from dataclasses import dataclass

# OWASP's recommended minimum for scrypt (N=2^17, r=8, p=1); about 128 MiB per check.
DEFAULT_COST = 2**17
DEFAULT_BLOCK_SIZE = 8
DEFAULT_PARALLELISM = 1
_SALT_BYTES = 16
_KEY_BYTES = 32
# Refuse parameters that would make a single check eat more than this, e.g. from a typo.
_MAX_MEMORY_BYTES = 256 * 1024 * 1024


class InvalidPasswordHash(ValueError):
    """The stored hash isn't one `hash_password` could have made."""


@dataclass(frozen=True)
class PasswordHash:
    cost: int
    block_size: int
    parallelism: int
    salt: bytes
    key: bytes

    def __str__(self) -> str:
        return ":".join(
            [
                "scrypt",
                str(self.cost),
                str(self.block_size),
                str(self.parallelism),
                _b64encode(self.salt),
                _b64encode(self.key),
            ]
        )

    def matches(self, password: str) -> bool:
        candidate = _derive(password, self.salt, self.cost, self.block_size, self.parallelism)
        return hmac.compare_digest(candidate, self.key)


def hash_password(
    password: str,
    *,
    cost: int = DEFAULT_COST,
    block_size: int = DEFAULT_BLOCK_SIZE,
    parallelism: int = DEFAULT_PARALLELISM,
) -> PasswordHash:
    if not password:
        raise ValueError("password must not be empty")
    salt = secrets.token_bytes(_SALT_BYTES)
    return PasswordHash(
        cost=cost,
        block_size=block_size,
        parallelism=parallelism,
        salt=salt,
        key=_derive(password, salt, cost, block_size, parallelism),
    )


def parse_password_hash(text: str) -> PasswordHash:
    parts = text.strip().split(":")
    if len(parts) != 6 or parts[0] != "scrypt":
        raise InvalidPasswordHash("expected scrypt:<n>:<r>:<p>:<salt>:<hash>")
    try:
        cost, block_size, parallelism = (int(part) for part in parts[1:4])
        salt, key = _b64decode(parts[4]), _b64decode(parts[5])
    except ValueError:
        raise InvalidPasswordHash("the numbers or base64 parts are malformed") from None
    if cost < 2 or cost & (cost - 1) or block_size < 1 or parallelism < 1:
        raise InvalidPasswordHash("n must be a power of two above 1, r and p at least 1")
    if _memory_needed(cost, block_size, parallelism) > _MAX_MEMORY_BYTES:
        raise InvalidPasswordHash("the scrypt parameters need too much memory")
    if not salt or len(key) != _KEY_BYTES:
        raise InvalidPasswordHash("the salt or hash has the wrong length")
    return PasswordHash(cost, block_size, parallelism, salt, key)


def _derive(password: str, salt: bytes, cost: int, block_size: int, parallelism: int) -> bytes:
    return hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=cost,
        r=block_size,
        p=parallelism,
        # hashlib's default 32 MiB limit is below what the default cost needs.
        maxmem=_memory_needed(cost, block_size, parallelism) + 1024 * 1024,
        dklen=_KEY_BYTES,
    )


def _memory_needed(cost: int, block_size: int, parallelism: int) -> int:
    return 128 * block_size * (cost + parallelism + 2)


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64decode(text: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
    except binascii.Error as error:
        raise ValueError(str(error)) from None
