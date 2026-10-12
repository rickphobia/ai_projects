"""Helpers for tests that score Items: feeds with known titles, and reading the Inbox."""

from collections.abc import Sequence
from datetime import timedelta
from email.utils import format_datetime
from typing import Any

from fastapi.testclient import TestClient

from rss_news.scoring.item_scoring import ItemScore, ScoringResult, UnscoredItem
from rss_news.sources.fetching import Fetched
from tests.support import PREFIX, FakeClock, FakeLanguageModel

INBOX = f"{PREFIX}/api/inbox"


def feed(clock: FakeClock, *titles: str, excerpt: str = "") -> Fetched:
    """A feed whose first title is the newest, an hour apart."""
    entries = "".join(
        f"<item><title>{title}</title><link>https://news.example/{number}</link>"
        f"<description>{excerpt}</description><pubDate>"
        f"{format_datetime(clock.now() - timedelta(hours=number + 1), usegmt=True)}"
        "</pubDate></item>"
        for number, title in enumerate(titles)
    )
    body = f'<rss version="2.0"><channel><title>t</title>{entries}</channel></rss>'
    return Fetched(body.encode(), "application/rss+xml", etag=None, last_modified=None)


def importance_by_title(items: Sequence[UnscoredItem]) -> ScoringResult:
    """Scores 'Story <n> ...' with Importance n."""
    scores = [
        ItemScore(item.id, int(item.title.split()[1]), f"Summary of {item.title}") for item in items
    ]
    return ScoringResult(scores, FakeLanguageModel.USAGE)


def inbox(client: TestClient, **params: Any) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = client.get(INBOX, params=params).json()["items"]
    return items


def titles(items: list[dict[str, Any]]) -> list[str]:
    return [item["title"] for item in items]
