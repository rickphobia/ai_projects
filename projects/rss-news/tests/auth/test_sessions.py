from datetime import UTC, datetime, timedelta

from rss_news.auth.sessions import SessionSigner

NOW = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)


def signer(secret: bytes = b"k" * 32, password_hash: str = "hash-1") -> SessionSigner:
    return SessionSigner(secret=secret, password_hash=password_hash, lifetime=timedelta(days=1))


def test_an_issued_cookie_is_valid_until_its_lifetime_ends() -> None:
    cookie = signer().issue(NOW)

    assert signer().is_valid(cookie, NOW + timedelta(hours=23))
    assert not signer().is_valid(cookie, NOW + timedelta(days=1))


def test_a_cookie_issued_in_the_future_is_refused() -> None:
    assert not signer().is_valid(signer().issue(NOW + timedelta(minutes=5)), NOW)


def test_a_new_secret_or_password_invalidates_old_cookies() -> None:
    cookie = signer().issue(NOW)

    assert not signer(secret=b"j" * 32).is_valid(cookie, NOW)
    assert not signer(password_hash="hash-2").is_valid(cookie, NOW)


def test_a_cookie_with_a_changed_issue_time_is_refused() -> None:
    _, issued, signature = signer().issue(NOW).split(".")

    assert not signer().is_valid(f"v1.{int(issued) + 86400}.{signature}", NOW)


def test_malformed_cookies_are_refused() -> None:
    for cookie in (None, "", "v1", "v2.1.abc", "v1.x.abc", "v1.1.2.3"):
        assert not signer().is_valid(cookie, NOW)
