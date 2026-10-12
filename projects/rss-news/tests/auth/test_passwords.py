import pytest

from rss_news.auth.passwords import (
    DEFAULT_COST,
    InvalidPasswordHash,
    hash_password,
    parse_password_hash,
)


def test_a_hash_matches_its_password_and_nothing_else() -> None:
    stored = parse_password_hash(str(hash_password("open sesame", cost=2**10)))

    assert stored.matches("open sesame")
    assert not stored.matches("open sesame ")
    assert not stored.matches("")


def test_the_same_password_hashes_differently_each_time() -> None:
    assert str(hash_password("same", cost=2**10)) != str(hash_password("same", cost=2**10))


def test_the_default_cost_is_the_owasp_minimum() -> None:
    text = str(hash_password("slow but safe"))

    assert text.startswith(f"scrypt:{DEFAULT_COST}:8:1:")
    assert DEFAULT_COST == 2**17
    assert parse_password_hash(text).matches("slow but safe")


@pytest.mark.parametrize(
    "text",
    [
        "",
        "plain text",
        "bcrypt:1:8:1:c2FsdA:a2V5",
        "scrypt:1000:8:1:c2FsdA:a2V5",  # n not a power of two
        "scrypt:1048576:8:1:c2FsdA:a2V5",  # 1 GiB of memory
        "scrypt:1024:8:1:c2FsdA:a2V5",  # hash too short
        "scrypt:1024:8:1:!!!:a2V5",
    ],
)
def test_malformed_hashes_are_refused(text: str) -> None:
    with pytest.raises(InvalidPasswordHash):
        parse_password_hash(text)


def test_an_empty_password_cannot_be_hashed() -> None:
    with pytest.raises(ValueError):
        hash_password("")
