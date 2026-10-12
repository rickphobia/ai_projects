"""Inbox search over title, excerpt and summary, and the tick deleting old Items."""

import sqlite3
from collections.abc import Sequence
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rss_news.config import Settings, load_settings
from rss_news.scoring.item_scoring import ItemScore, ScoringResult, UnscoredItem
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.sources.fetching import Fetched
from rss_news.wiring import Wiring
from tests.scoring.scored_feeds import INBOX, inbox, titles
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    app_env,
    make_wiring,
)

AI_FEED = "https://ai.example/rss"
WORLD_FEED = "https://world.example/rss"
STARTER = (
    StarterFolder("AI", (StarterSource("AI News", AI_FEED),)),
    StarterFolder("World", (StarterSource("World News", WORLD_FEED),)),
)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return load_settings(app_env(tmp_path, RSS_NEWS_ITEM_MAX_AGE_DAYS="90"))


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def fetcher() -> FakeFeedFetcher:
    return FakeFeedFetcher()


@pytest.fixture
def language_model() -> FakeLanguageModel:
    return FakeLanguageModel()


@pytest.fixture
def wiring(
    settings: Settings,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> Wiring:
    return make_wiring(
        settings,
        clock,
        feed_fetcher=fetcher,
        language_model=language_model,
        starter_folders=STARTER,
    )


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


def rss(site: str, *items: tuple[str, str]) -> Fetched:
    """A feed with (title, excerpt) items, linked under `site`."""
    entries = "".join(
        f"<item><title>{title}</title><link>https://{site}/{number}</link>"
        f"<description>{excerpt}</description></item>"
        for number, (title, excerpt) in enumerate(items)
    )
    body = f'<rss version="2.0"><channel><title>t</title>{entries}</channel></rss>'
    return Fetched(body.encode(), "application/rss+xml", etag=None, last_modified=None)


def summary_mentions_tariffs(items: Sequence[UnscoredItem]) -> ScoringResult:
    scores = [
        ItemScore(item.id, 3, "New tariffs" if "Trade" in item.title else "Something else")
        for item in items
    ]
    return ScoringResult(scores, FakeLanguageModel.USAGE)


def test_search_matches_title_excerpt_and_summary(
    client: TestClient,
    wiring: Wiring,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> None:
    fetcher.answers[AI_FEED] = rss(
        "ai.example",
        ("Gemma release notes", "Weights are out"),
        ("Benchmarks roundup", "A new Gemma model tops the chart"),
        ("Unrelated story", "Nothing here"),
    )
    fetcher.answers[WORLD_FEED] = rss("world.example", ("Trade talks resume", "Officials meet"))
    language_model.answer = summary_mentions_tariffs
    wiring.tick.run()

    assert sorted(titles(inbox(client, search="gemma"))) == [
        "Benchmarks roundup",
        "Gemma release notes",
    ]
    assert titles(inbox(client, search="tariff")) == ["Trade talks resume"]
    # Every word must match.
    assert titles(inbox(client, search="gemma weights")) == ["Gemma release notes"]
    assert inbox(client, search="nowhere") == []


def test_search_combines_with_folder_and_importance_filters(
    client: TestClient,
    wiring: Wiring,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> None:
    fetcher.answers[AI_FEED] = rss("ai.example", ("Trade in GPUs", "Chips"))
    fetcher.answers[WORLD_FEED] = rss(
        "world.example", ("Trade talks resume", "Officials"), ("Trade fair opens", "Stalls")
    )
    language_model.answer = lambda items: ScoringResult(
        [ItemScore(item.id, 5 if "talks" in item.title else 2, "s") for item in items],
        FakeLanguageModel.USAGE,
    )
    wiring.tick.run()
    folders = client.get(f"{PREFIX}/api/folders").json()["folders"]
    world = next(folder["id"] for folder in folders if folder["name"] == "World")

    assert sorted(titles(inbox(client, search="trade", folder=world))) == [
        "Trade fair opens",
        "Trade talks resume",
    ]
    assert titles(inbox(client, search="trade", min_importance=4)) == ["Trade talks resume"]


def test_search_text_is_not_read_as_query_syntax(
    client: TestClient, wiring: Wiring, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[AI_FEED] = rss("ai.example", ("GPT-6 launch", "OpenAI's new model"))
    wiring.tick.run()

    for search in ['"GPT-6', "gpt-6", "OpenAI's", "launch*", "AND OR NOT", "  "]:
        response = client.get(INBOX, params={"search": search})
        assert response.status_code == 200, search
    assert titles(inbox(client, search="gpt-6")) == ["GPT-6 launch"]
    # A blank search box shows the whole Inbox.
    assert titles(inbox(client, search="  ")) == ["GPT-6 launch"]


def test_the_tick_deletes_items_older_than_the_max_age_and_their_search_entries(
    client: TestClient,
    wiring: Wiring,
    settings: Settings,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
) -> None:
    fetcher.answers[AI_FEED] = rss("ai.example", ("Old Gemma story", "x"))
    wiring.tick.run()
    clock.advance(timedelta(days=60))
    fetcher.answers[AI_FEED] = rss("ai.example/newer", ("Newer Gemma story", "x"))
    wiring.tick.run()

    clock.advance(timedelta(days=30, minutes=1))
    wiring.tick.run()

    # The sign-in from 90 days ago has expired.
    client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})
    assert titles(inbox(client)) == ["Newer Gemma story"]
    assert titles(inbox(client, search="gemma")) == ["Newer Gemma story"]
    with sqlite3.connect(settings.database_path) as connection:
        indexed = connection.execute(
            "SELECT count(*) FROM items_search WHERE items_search MATCH 'old'"
        ).fetchone()[0]
    assert indexed == 0
