"""Shared test helpers: a stand-in PWA build and the environment the app needs."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from rss_news.auth.passwords import hash_password

PREFIX = "/ai-projects/rss-news"
OWNER_PASSWORD = "correct horse battery staple"
# A cheap scrypt cost keeps the tests fast; production hashes use the default cost.
OWNER_PASSWORD_HASH = str(hash_password(OWNER_PASSWORD, cost=2**10))
SESSION_SECRET = "s" * 32
PWA_INDEX = "<!doctype html><title>rss-news test build</title>"


def fake_pwa_build(folder: Path) -> Path:
    """A folder shaped like `npm run build` output, so tests don't need Node."""
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "index.html").write_text(PWA_INDEX)
    (folder / "assets").mkdir(exist_ok=True)
    (folder / "assets" / "main.js").write_text("console.log('rss-news');")
    return folder


def app_env(tmp_path: Path, **overrides: str) -> dict[str, str]:
    """The smallest environment load_settings accepts, pointing at files under `tmp_path`."""
    return {
        "RSS_NEWS_PWA_DIR": str(fake_pwa_build(tmp_path / "pwa")),
        "RSS_NEWS_DATABASE_PATH": str(tmp_path / "rss-news.sqlite3"),
        "RSS_NEWS_PASSWORD_HASH": OWNER_PASSWORD_HASH,
        "RSS_NEWS_SESSION_SECRET": SESSION_SECRET,
        # The test client talks plain http.
        "RSS_NEWS_SECURE_COOKIES": "false",
        **overrides,
    }


class FakeClock:
    def __init__(self, start: datetime = datetime(2026, 10, 12, 12, 0, tzinfo=UTC)) -> None:
        self.current = start

    def now(self) -> datetime:
        return self.current

    def advance(self, delta: timedelta) -> None:
        self.current += delta
