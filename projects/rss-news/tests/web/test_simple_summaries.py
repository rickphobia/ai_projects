"""Simple summaries: one whole Item explained in plain words from its Reader view, the ledger
row, the spending limit, and what is refused."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rss_news.config import load_settings
from rss_news.items.reading import ReaderView
from rss_news.simple_summaries.summarising import (
    LONGEST_TEXT,
    SimpleSummaryFailed,
    SimpleSummaryRequest,
)
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.sources.fetching import Fetched
from rss_news.spending.ledger import AiUsage, Feature
from rss_news.wiring import Wiring
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeArticleExtractor,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    app_env,
    make_wiring,
)

FEED = "https://world.example/rss"
STORY = "https://world.example/story"
PHOTO = "https://world.example/photo"
STARTER = (StarterFolder("World", (StarterSource("World News", FEED),)),)
# A story whose feed gives a preview, and a photo whose feed gives no text at all.
FEED_BODY = (
    '<rss version="2.0"><channel><title>t</title>'
    f"<item><title>A story</title><link>{STORY}</link>"
    "<description>What the feed says.</description></item>"
    f"<item><title>A photo</title><link>{PHOTO}</link></item>"
    "</channel></rss>"
)


@pytest.fixture
def model() -> FakeLanguageModel:
    return FakeLanguageModel()


@pytest.fixture
def extractor() -> FakeArticleExtractor:
    return FakeArticleExtractor()


@pytest.fixture
def wiring(tmp_path: Path, model: FakeLanguageModel, extractor: FakeArticleExtractor) -> Wiring:
    fetcher = FakeFeedFetcher()
    fetcher.answers[FEED] = Fetched(
        FEED_BODY.encode(), "application/rss+xml", etag=None, last_modified=None
    )
    wiring = make_wiring(
        load_settings(app_env(tmp_path, RSS_NEWS_MONTHLY_LIMIT_USD="10")),
        FakeClock(),
        feed_fetcher=fetcher,
        language_model=model,
        article_extractor=extractor,
        starter_folders=STARTER,
    )
    wiring.tick.run()
    return wiring


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


def summary_calls(wiring: Wiring) -> int:
    """Ledger rows for Simple summaries; the tick that fetched the Items also scored them."""
    return sum(call.feature is Feature.SIMPLE_SUMMARIES for call in wiring.ledger.calls())


def item_id(client: TestClient, title: str) -> int:
    items = client.get(f"{PREFIX}/api/inbox").json()["items"]
    return int(next(item["id"] for item in items if item["title"] == title))


def test_a_summary_explains_the_whole_article_and_records_the_call(
    client: TestClient,
    model: FakeLanguageModel,
    extractor: FakeArticleExtractor,
    wiring: Wiring,
) -> None:
    extractor.pages[STORY] = ReaderView(title="A story", text="First paragraph.\nSecond one.")

    response = client.post(f"{PREFIX}/api/items/{item_id(client, 'A story')}/simple-summary")

    assert response.status_code == 200
    # 4,000 input and 400 output tokens of Haiku at $0.10 and $0.50 per million.
    assert response.json() == {
        "gist": "A story, simply.",
        "points": ["First point of A story.", "Why it matters."],
        "from_preview": False,
        "cost_usd": "0.0006",
    }
    assert model.simple_summaries == [
        SimpleSummaryRequest("A story", "World News", "First paragraph.\nSecond one.")
    ]
    assert summary_calls(wiring) == 1


def test_a_very_long_article_is_cut_to_the_longest_text_sent(
    client: TestClient, model: FakeLanguageModel, extractor: FakeArticleExtractor
) -> None:
    extractor.pages[STORY] = ReaderView(title=None, text="word " * LONGEST_TEXT)

    assert (
        client.post(f"{PREFIX}/api/items/{item_id(client, 'A story')}/simple-summary").status_code
        == 200
    )

    assert len(model.simple_summaries[0].text) == LONGEST_TEXT


def test_an_unreadable_page_is_summarised_from_the_feeds_preview_and_says_so(
    client: TestClient, model: FakeLanguageModel
) -> None:
    response = client.post(f"{PREFIX}/api/items/{item_id(client, 'A story')}/simple-summary")

    assert response.status_code == 200
    assert response.json()["from_preview"] is True
    assert model.simple_summaries[0].text == "What the feed says."


def test_an_item_with_no_text_at_all_is_refused_without_calling_the_model(
    client: TestClient, model: FakeLanguageModel
) -> None:
    response = client.post(f"{PREFIX}/api/items/{item_id(client, 'A photo')}/simple-summary")

    assert response.status_code == 422
    assert response.json()["detail"].startswith("Nothing to summarise")
    assert model.simple_summaries == []


def test_an_unknown_item_is_not_found(client: TestClient, model: FakeLanguageModel) -> None:
    assert client.post(f"{PREFIX}/api/items/9999/simple-summary").status_code == 404
    assert model.simple_summaries == []


def test_a_summary_is_refused_at_the_spending_limit_without_calling_the_model(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    for _ in range(10):
        wiring.ledger.record(
            Feature.BRIEFINGS,
            AiUsage("claude-opus-5-5", 250_000, 0, 0, model.SIMPLE_SUMMARY_USAGE.duration),
        )

    response = client.post(f"{PREFIX}/api/items/{item_id(client, 'A story')}/simple-summary")

    assert response.status_code == 429
    assert "Simple summaries" in response.json()["detail"]
    assert model.simple_summaries == []


def test_a_failed_summary_says_why_and_still_records_what_the_model_used(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    model.simple_summary_failure = SimpleSummaryFailed(
        "stop reason refusal", model.SIMPLE_SUMMARY_USAGE
    )

    response = client.post(f"{PREFIX}/api/items/{item_id(client, 'A story')}/simple-summary")

    assert response.status_code == 502
    assert "stop reason refusal" in response.json()["detail"]
    assert summary_calls(wiring) == 1


def test_summarising_needs_a_session(wiring: Wiring) -> None:
    response = TestClient(wiring.app).post(f"{PREFIX}/api/items/1/simple-summary")

    assert response.status_code == 401
