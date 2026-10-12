"""The Inbox by Importance: filtering, sorting and paging over Items the fake model scored."""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.config import Settings, load_settings
from rss_news.scoring.item_scoring import (
    ScoringResult,
    UnscoredItem,
)
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.wiring import Wiring
from tests.scoring.scored_feeds import INBOX, feed, importance_by_title, inbox, titles
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    app_env,
    make_wiring,
)

FEED = "https://news.example/rss"
STARTER = (StarterFolder("World", (StarterSource("World News", FEED),)),)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return load_settings(app_env(tmp_path, RSS_NEWS_SCORING_BATCH_SIZE="4"))


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


def test_the_inbox_filters_by_minimum_importance(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> None:
    language_model.answer = importance_by_title
    fetcher.answers[FEED] = feed(clock, "Story 2 a", "Story 5 b", "Story 4 c", "Story 1 d")
    wiring.tick.run()

    assert titles(inbox(client, min_importance=4)) == ["Story 5 b", "Story 4 c"]


def test_the_inbox_sorts_by_importance_with_unscored_items_last(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> None:
    def all_but_unscored(items: Sequence[UnscoredItem]) -> ScoringResult:
        return importance_by_title([item for item in items if "Unscored" not in item.title])

    language_model.answer = all_but_unscored
    fetcher.answers[FEED] = feed(
        clock, "Story 2 newer", "Unscored 9", "Story 5 only", "Story 2 older"
    )
    wiring.tick.run()

    assert titles(inbox(client, sort="importance")) == [
        "Story 5 only",
        "Story 2 newer",
        "Story 2 older",
        "Unscored 9",
    ]


def test_paging_by_importance_visits_every_item_once(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> None:
    language_model.answer = importance_by_title
    fetcher.answers[FEED] = feed(
        clock, "Story 3 a", "Story 5 b", "Story 3 c", "Story 1 d", "Story 4 e"
    )
    wiring.tick.run()

    seen: list[str] = []
    cursor = None
    while True:
        params: dict[str, Any] = {"sort": "importance", "limit": 2}
        if cursor:
            params["cursor"] = cursor
        page = client.get(INBOX, params=params).json()
        seen += titles(page["items"])
        cursor = page["next_cursor"]
        if cursor is None:
            break

    assert seen == ["Story 5 b", "Story 4 e", "Story 3 a", "Story 3 c", "Story 1 d"]


def test_a_cursor_from_the_other_order_is_refused(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[FEED] = feed(clock, "Story 1", "Story 2")
    wiring.tick.run()
    newest_cursor = client.get(INBOX, params={"limit": 1}).json()["next_cursor"]

    response = client.get(INBOX, params={"sort": "importance", "cursor": newest_cursor})

    assert response.status_code == 400


@pytest.mark.parametrize("params", [{"min_importance": 0}, {"min_importance": 6}, {"sort": "x"}])
def test_bad_importance_filters_are_refused(client: TestClient, params: dict[str, Any]) -> None:
    assert client.get(INBOX, params=params).status_code == 422
