"""Scoring new Items: the tick scores through the fake LanguageModel, the Inbox API shows the
scores, and every call lands in the spending ledger."""

import logging
from collections.abc import Sequence
from datetime import timedelta
from decimal import Decimal
from email.utils import format_datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.config import Settings, load_settings
from rss_news.scoring.item_scoring import (
    MAX_CALLS_PER_TICK,
    ItemScore,
    ScoringResult,
    UnscoredItem,
)
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.sources.fetching import Fetched
from rss_news.spending.ledger import Feature
from rss_news.wiring import Wiring
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    app_env,
    make_wiring,
)

INBOX = f"{PREFIX}/api/inbox"
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


def test_new_items_show_their_importance_and_summary_in_the_inbox(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[FEED] = feed(clock, "Fed cuts rates", "BNM kekalkan OPR")

    wiring.tick.run()

    assert [(item["importance"], item["summary"]) for item in inbox(client)] == [
        (3, "Summary of Fed cuts rates"),
        (3, "Summary of BNM kekalkan OPR"),
    ]


def test_items_are_sent_in_batches_of_the_configured_size(
    wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher, language_model: FakeLanguageModel
) -> None:
    fetcher.answers[FEED] = feed(clock, *[f"Story {number}" for number in range(10)])

    wiring.tick.run()

    assert [len(call) for call in language_model.calls] == [4, 4, 2]


def test_a_batch_stays_under_the_prompt_token_limit(
    tmp_path: Path, clock: FakeClock, fetcher: FakeFeedFetcher, language_model: FakeLanguageModel
) -> None:
    # Each Item is about 330 estimated tokens (600 characters of excerpt shown, at 2 per
    # token), and the instructions count 1,000: two Items fit under 1,800, three don't.
    settings = load_settings(app_env(tmp_path, RSS_NEWS_SCORING_PROMPT_TOKEN_LIMIT="1800"))
    wiring = make_wiring(
        settings,
        clock,
        feed_fetcher=fetcher,
        language_model=language_model,
        starter_folders=STARTER,
    )
    fetcher.answers[FEED] = feed(clock, "A", "B", "C", "D", "E", excerpt="x" * 2000)

    wiring.tick.run()

    assert [len(call) for call in language_model.calls] == [2, 2, 1]


def test_every_call_is_recorded_in_the_ledger_with_its_cost(
    wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[FEED] = feed(clock, *[f"Story {number}" for number in range(6)])

    wiring.tick.run()

    calls = wiring.ledger.calls()
    assert len(calls) == 2
    first = calls[0]
    assert first.feature is Feature.SCORING
    assert first.called_at == clock.now()
    assert first.usage == FakeLanguageModel.USAGE
    # 10,000 input tokens at $0.10 and 2,000 output tokens at $0.50 per million.
    assert first.cost_usd == Decimal("0.002")


def test_ai_calls_are_logged_with_model_tokens_cost_and_latency(
    wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher, caplog: pytest.LogCaptureFixture
) -> None:
    fetcher.answers[FEED] = feed(clock, "Story 1")

    with caplog.at_level(logging.INFO):
        wiring.tick.run()

    (record,) = [record for record in caplog.records if record.getMessage() == "ai call"]
    assert record.__dict__["feature"] == "scoring"
    assert record.__dict__["model"] == "claude-haiku-5-5"
    assert (record.__dict__["input_tokens"], record.__dict__["output_tokens"]) == (10_000, 2_000)
    assert record.__dict__["cost_usd"] == "0.002"
    assert record.__dict__["duration_ms"] == 3000


def test_a_failed_batch_leaves_its_items_unscored_but_in_the_inbox(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
    caplog: pytest.LogCaptureFixture,
) -> None:
    language_model.failing_titles = {"Story"}
    fetcher.answers[FEED] = feed(clock, "Story 1", "Story 2")

    with caplog.at_level(logging.WARNING):
        wiring.tick.run()

    assert [(item["importance"], item["summary"]) for item in inbox(client)] == [
        (None, None),
        (None, None),
    ]
    assert "scoring failed" in [record.getMessage() for record in caplog.records]
    # The failed call still cost money, so it is in the ledger.
    assert len(wiring.ledger.calls()) == 1
    # A failed batch is not a failed tick step.
    assert client.get(f"{PREFIX}/healthz").json()["last_tick_seconds_ago"] == 0


def test_failed_items_are_retried_on_a_later_tick_after_a_delay(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> None:
    language_model.failing_titles = {"Story"}
    fetcher.answers[FEED] = feed(clock, "Story 1")
    wiring.tick.run()
    language_model.failing_titles = set()

    clock.advance(timedelta(seconds=30))
    wiring.tick.run()
    assert len(language_model.calls) == 1

    clock.advance(timedelta(seconds=30))
    wiring.tick.run()

    assert len(language_model.calls) == 2
    assert inbox(client)[0]["importance"] == 3


def test_an_item_that_keeps_failing_ends_up_alone_and_the_rest_get_scored(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> None:
    language_model.failing_titles = {"Poison"}
    fetcher.answers[FEED] = feed(clock, "Story 1", "Poison 2", "Story 3", "Story 4")

    for _ in range(4):
        wiring.tick.run()
        clock.advance(timedelta(hours=1))

    # Batches of 4, then 2 after one failure, then 1 after two: only the first tick's Items
    # wait for the poisoned one.
    assert [len(call) for call in language_model.calls] == [4, 2, 2, 1, 1, 1]
    scored = {item["title"]: item["importance"] for item in inbox(client)}
    assert scored == {"Story 1": 3, "Poison 2": None, "Story 3": 3, "Story 4": 3}


def test_items_left_out_of_the_answer_are_retried(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> None:
    def first_only(items: Sequence[UnscoredItem]) -> ScoringResult:
        return ScoringResult([ItemScore(items[0].id, 4, "First")], FakeLanguageModel.USAGE)

    language_model.answer = first_only
    fetcher.answers[FEED] = feed(clock, "Story 1", "Story 2")
    wiring.tick.run()
    language_model.answer = FakeLanguageModel.score_all
    clock.advance(timedelta(minutes=1))

    wiring.tick.run()

    assert [item["importance"] for item in inbox(client)] == [4, 3]


def test_scores_out_of_range_or_for_other_items_are_ignored(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
) -> None:
    def wrong(items: Sequence[UnscoredItem]) -> ScoringResult:
        scores = [ItemScore(items[0].id, 9, "Too important"), ItemScore(999, 3, "Not asked")]
        return ScoringResult(scores, FakeLanguageModel.USAGE)

    language_model.answer = wrong
    fetcher.answers[FEED] = feed(clock, "Story 1")

    wiring.tick.run()

    assert inbox(client)[0]["importance"] is None


def test_a_large_backlog_is_scored_over_several_ticks(
    wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher, language_model: FakeLanguageModel
) -> None:
    fetcher.answers[FEED] = feed(clock, *[f"Story {number}" for number in range(45)])

    wiring.tick.run()
    assert len(language_model.calls) == MAX_CALLS_PER_TICK

    wiring.tick.run()
    assert sum(len(call) for call in language_model.calls) == 45


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
