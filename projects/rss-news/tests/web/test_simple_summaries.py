"""Simple summaries: one whole Item explained in plain words from its Reader view, written in a
job that runs on if the page is closed and saved for its Item; the ledger row, the spending
limit, and what is refused."""

import threading
from pathlib import Path
from typing import Any

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
    GATE_WAIT,
    OWNER_PASSWORD,
    PREFIX,
    FakeArticleExtractor,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    FakePushSender,
    app_env,
    events,
    make_wiring,
    post_and_leave,
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
PHONE = "https://fcm.googleapis.com/fcm/send/phone-token"


@pytest.fixture
def model() -> FakeLanguageModel:
    return FakeLanguageModel()


@pytest.fixture
def extractor() -> FakeArticleExtractor:
    return FakeArticleExtractor()


@pytest.fixture
def sender() -> FakePushSender:
    return FakePushSender()


@pytest.fixture
def wiring(
    tmp_path: Path,
    model: FakeLanguageModel,
    extractor: FakeArticleExtractor,
    sender: FakePushSender,
) -> Wiring:
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
        push_sender=sender,
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


def summary_path(item: int) -> str:
    return f"{PREFIX}/api/items/{item}/simple-summary"


def summarise(client: TestClient, title: str) -> tuple[str, dict[str, Any]]:
    """Press Summarise and wait for the stream to end; its last event, after the `job` one."""
    response = client.post(summary_path(item_id(client, title)))
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    streamed = events(response.text)
    assert [name for name, _ in streamed[:-1]] == ["job"]
    return streamed[-1]


def saved(client: TestClient, title: str) -> dict[str, Any] | None:
    response = client.get(summary_path(item_id(client, title)))
    assert response.status_code == 200
    summary: dict[str, Any] | None = response.json()["summary"]
    return summary


def cookie(client: TestClient) -> str:
    return "; ".join(f"{name}={value}" for name, value in client.cookies.items())


def leave_summary(wiring: Wiring, client: TestClient) -> str:
    """Press Summarise and close the page while the model is still writing; the job's id."""
    started = post_and_leave(
        wiring.app, summary_path(item_id(client, "A story")), {}, cookie(client)
    )
    return str(started["id"])


def finish(wiring: Wiring, model: FakeLanguageModel, job_id: str) -> None:
    assert model.gate is not None
    model.gate.set()
    job = wiring.jobs.get(job_id)
    assert job is not None
    assert job.wait_finished(GATE_WAIT.total_seconds())


def test_a_summary_explains_the_whole_article_and_records_the_call(
    client: TestClient,
    model: FakeLanguageModel,
    extractor: FakeArticleExtractor,
    wiring: Wiring,
) -> None:
    extractor.pages[STORY] = ReaderView(title="A story", text="First paragraph.\nSecond one.")

    # 4,000 input and 400 output tokens of Haiku at $0.10 and $0.50 per million.
    assert summarise(client, "A story") == (
        "summary",
        {
            "gist": "A story, simply.",
            "points": ["First point of A story.", "Why it matters."],
            "from_preview": False,
            "cost_usd": "0.0006",
        },
    )
    assert model.simple_summaries == [
        SimpleSummaryRequest("A story", "World News", "First paragraph.\nSecond one.")
    ]
    assert summary_calls(wiring) == 1


def test_a_very_long_article_is_cut_to_the_longest_text_sent(
    client: TestClient, model: FakeLanguageModel, extractor: FakeArticleExtractor
) -> None:
    extractor.pages[STORY] = ReaderView(title=None, text="word " * LONGEST_TEXT)

    assert summarise(client, "A story")[0] == "summary"

    assert len(model.simple_summaries[0].text) == LONGEST_TEXT


def test_an_unreadable_page_is_summarised_from_the_feeds_preview_and_says_so(
    client: TestClient, model: FakeLanguageModel
) -> None:
    name, summary = summarise(client, "A story")

    assert name == "summary"
    assert summary["from_preview"] is True
    assert model.simple_summaries[0].text == "What the feed says."


def test_an_item_with_no_text_at_all_is_refused_without_calling_the_model(
    client: TestClient, model: FakeLanguageModel
) -> None:
    name, failure = summarise(client, "A photo")

    assert name == "failed"
    assert failure["detail"].startswith("Nothing to summarise: there is no text to summarise")
    assert model.simple_summaries == []
    assert saved(client, "A photo") is None


def test_an_unknown_item_is_not_found(client: TestClient, model: FakeLanguageModel) -> None:
    assert client.post(summary_path(9999)).status_code == 404
    assert client.get(summary_path(9999)).status_code == 404
    assert model.simple_summaries == []


def test_a_summary_is_refused_at_the_spending_limit_without_calling_the_model(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    for _ in range(10):
        wiring.ledger.record(
            Feature.BRIEFINGS,
            AiUsage("claude-opus-5-5", 250_000, 0, 0, model.SIMPLE_SUMMARY_USAGE.duration),
        )

    response = client.post(summary_path(item_id(client, "A story")))

    assert response.status_code == 429
    assert "Simple summaries" in response.json()["detail"]
    assert model.simple_summaries == []


def test_a_failed_summary_says_why_and_still_records_what_the_model_used(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    model.simple_summary_failure = SimpleSummaryFailed(
        "stop reason refusal", model.SIMPLE_SUMMARY_USAGE
    )

    name, failure = summarise(client, "A story")

    assert name == "failed"
    assert failure["detail"] == "The summary couldn't be written: stop reason refusal."
    assert summary_calls(wiring) == 1
    assert saved(client, "A story") is None


def test_summarising_needs_a_session(wiring: Wiring) -> None:
    assert TestClient(wiring.app).post(summary_path(1)).status_code == 401
    assert TestClient(wiring.app).get(summary_path(1)).status_code == 401


def test_an_item_has_no_saved_summary_until_summarise_is_pressed(client: TestClient) -> None:
    assert saved(client, "A story") is None


def test_a_summary_is_saved_for_its_item(client: TestClient, wiring: Wiring) -> None:
    _, written = summarise(client, "A story")

    assert saved(client, "A story") == written
    assert saved(client, "A photo") is None
    # Showing the saved one calls no model.
    assert summary_calls(wiring) == 1


def test_summarising_again_replaces_the_saved_summary_and_pays_again(
    client: TestClient, extractor: FakeArticleExtractor, wiring: Wiring
) -> None:
    summarise(client, "A story")
    extractor.pages[STORY] = ReaderView(title="A story", text="The whole article now.")

    _, again = summarise(client, "A story")

    assert again["from_preview"] is False
    assert saved(client, "A story") == again
    assert summary_calls(wiring) == 2


def test_a_summary_is_written_and_saved_after_the_page_is_closed(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel
) -> None:
    model.gate = threading.Event()
    job_id = leave_summary(wiring, client)
    assert saved(client, "A story") is None

    finish(wiring, model, job_id)

    summary = saved(client, "A story")
    assert summary is not None
    assert summary["gist"] == "A story, simply."
    assert summary_calls(wiring) == 1


def test_a_finished_summary_can_be_followed_again_by_its_job(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel
) -> None:
    model.gate = threading.Event()
    job_id = leave_summary(wiring, client)
    finish(wiring, model, job_id)

    streamed = events(client.get(f"{PREFIX}/api/jobs/{job_id}").text)

    assert streamed == [("job", {"id": job_id}), ("summary", saved(client, "A story"))]


def test_pressing_summarise_again_joins_the_summary_being_written(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel
) -> None:
    model.gate = threading.Event()
    first = leave_summary(wiring, client)
    second = leave_summary(wiring, client)

    finish(wiring, model, first)

    assert second == first
    assert len(model.simple_summaries) == 1


def test_a_finished_summary_sends_no_alert(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel, sender: FakePushSender
) -> None:
    subscription = {"endpoint": PHONE, "keys": {"p256dh": "BPhoneKey", "auth": "a"}}
    assert client.post(f"{PREFIX}/api/push/subscriptions", json=subscription).status_code == 204
    model.gate = threading.Event()

    finish(wiring, model, leave_summary(wiring, client))

    assert sender.delivered == []


def test_a_saved_summary_goes_with_its_item(client: TestClient) -> None:
    summarise(client, "A story")
    story = item_id(client, "A story")
    source_id = client.get(f"{PREFIX}/api/sources").json()["sources"][0]["id"]

    assert client.delete(f"{PREFIX}/api/sources/{source_id}").status_code == 204

    assert client.get(summary_path(story)).status_code == 404
