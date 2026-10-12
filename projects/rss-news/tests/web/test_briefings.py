"""Brief me: choosing the last 24 hours' Items, the estimate, writing a section per Folder with
progress, reusing today's Briefing, Regenerate, and failing without saving anything."""

import json
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.briefings.briefing import SectionRequest, SectionResult, WrittenPoint
from rss_news.config import load_settings
from rss_news.items.reading import ReaderView
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.spending.ledger import Feature
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
from tests.web.test_inbox import hours_ago, rss

BRIEFINGS = f"{PREFIX}/api/briefings"
AI_FEED = "https://ai.example/rss"
WORLD_FEED = "https://world.example/rss"
STARTER = (
    StarterFolder("AI", (StarterSource("AI News", AI_FEED),)),
    StarterFolder("World", (StarterSource("World News", WORLD_FEED),)),
    StarterFolder("Empty", (StarterSource("Quiet", "https://quiet.example/rss"),)),
)


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def fetcher(clock: FakeClock) -> FakeFeedFetcher:
    fetcher = FakeFeedFetcher()
    fetcher.answers[AI_FEED] = rss(
        ("New model released", "https://ai.example/model", hours_ago(clock, 2)),
        ("Chip export rules", "https://ai.example/chips", hours_ago(clock, 5)),
        ("Last week's benchmark", "https://ai.example/old", hours_ago(clock, 30)),
    )
    fetcher.answers[WORLD_FEED] = rss(
        ("Ceasefire agreed", "https://world.example/ceasefire", hours_ago(clock, 1)),
    )
    return fetcher


@pytest.fixture
def model() -> FakeLanguageModel:
    return FakeLanguageModel()


@pytest.fixture
def extractor() -> FakeArticleExtractor:
    extractor = FakeArticleExtractor()
    extractor.pages["https://ai.example/model"] = ReaderView("New model", "The full article.")
    return extractor


def build(
    tmp_path: Path,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    model: FakeLanguageModel,
    extractor: FakeArticleExtractor,
    **env: str,
) -> Wiring:
    wiring = make_wiring(
        load_settings(app_env(tmp_path, **env)),
        clock,
        feed_fetcher=fetcher,
        language_model=model,
        article_extractor=extractor,
        starter_folders=STARTER,
    )
    wiring.tick.run()
    return wiring


@pytest.fixture
def wiring(
    tmp_path: Path,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    model: FakeLanguageModel,
    extractor: FakeArticleExtractor,
) -> Wiring:
    return build(tmp_path, clock, fetcher, model, extractor)


def signed_in(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    return signed_in(wiring)


def events(client: TestClient, *, regenerate: bool = False) -> list[tuple[str, dict[str, Any]]]:
    response = client.post(BRIEFINGS, json={"regenerate": regenerate})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    parsed = []
    for block in response.text.strip().split("\n\n"):
        name_line, data_line = block.split("\n")
        parsed.append(
            (name_line.removeprefix("event: "), json.loads(data_line.removeprefix("data: ")))
        )
    return parsed


def written(client: TestClient, *, regenerate: bool = False) -> dict[str, Any]:
    name, data = events(client, regenerate=regenerate)[-1]
    assert name == "briefing", data
    return data


def briefing_calls(wiring: Wiring) -> list[Decimal]:
    return [call.cost_usd for call in wiring.ledger.calls() if call.feature is Feature.BRIEFINGS]


def test_there_is_no_latest_briefing_at_first(client: TestClient) -> None:
    response = client.get(f"{BRIEFINGS}/latest")

    assert response.status_code == 200
    assert response.json() == {"briefing": None}


def test_briefings_need_a_session(wiring: Wiring) -> None:
    client = TestClient(wiring.app)

    assert client.get(f"{BRIEFINGS}/latest").status_code == 401
    assert client.get(f"{BRIEFINGS}/estimate").status_code == 401
    assert client.post(BRIEFINGS, json={}).status_code == 401


def test_the_estimate_counts_the_last_24_hours_without_calling_the_model(
    client: TestClient, model: FakeLanguageModel, extractor: FakeArticleExtractor
) -> None:
    response = client.get(f"{BRIEFINGS}/estimate")

    assert response.status_code == 200
    estimate = response.json()
    assert estimate["item_count"] == 3
    assert estimate["section_count"] == 2
    assert Decimal(estimate["estimated_cost_usd"]) > 0
    assert model.sections == []
    assert extractor.requested == []


def test_the_estimate_follows_the_configured_prices(
    tmp_path: Path,
    client: TestClient,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    model: FakeLanguageModel,
    extractor: FakeArticleExtractor,
) -> None:
    usual = Decimal(client.get(f"{BRIEFINGS}/estimate").json()["estimated_cost_usd"])
    doubled = build(
        tmp_path / "doubled",
        clock,
        fetcher,
        model,
        extractor,
        RSS_NEWS_MODEL_PRICES="claude-haiku-5-5=0.10/0.50,claude-opus-5-5=8/40",
    )

    estimate = signed_in(doubled).get(f"{BRIEFINGS}/estimate").json()

    assert Decimal(estimate["estimated_cost_usd"]) == pytest.approx(usual * 2, abs=Decimal("0.01"))


def test_the_estimate_is_zero_when_nothing_arrived(client: TestClient, clock: FakeClock) -> None:
    clock.advance(timedelta(days=2))

    assert client.get(f"{BRIEFINGS}/estimate").json() == {
        "item_count": 0,
        "section_count": 0,
        "estimated_cost_usd": "0.00",
    }


def test_nothing_to_brief_is_refused(client: TestClient, clock: FakeClock) -> None:
    clock.advance(timedelta(days=2))

    response = client.post(BRIEFINGS, json={})

    assert response.status_code == 422
    assert response.json()["detail"] == "No Items arrived in the last 24 hours."


def test_brief_me_streams_progress_then_a_briefing_grouped_by_folder(client: TestClient) -> None:
    streamed = events(client)

    assert [(name, data.get("step"), data.get("folder")) for name, data in streamed[:-1]] == [
        ("progress", "reading", "AI"),
        ("progress", "writing", "AI"),
        ("progress", "reading", "World"),
        ("progress", "writing", "World"),
    ]
    assert streamed[0][1]["section"] == 1
    assert streamed[0][1]["sections"] == 2
    name, done = streamed[-1]
    assert name == "briefing"
    assert done["reused"] is False
    briefing = done["briefing"]
    assert briefing["scope"] == "all-24h"
    assert briefing["item_count"] == 3
    assert [section["folder"]["name"] for section in briefing["sections"]] == ["AI", "World"]
    ai_points = briefing["sections"][0]["points"]
    assert [point["text"] for point in ai_points] == [
        "Point about New model released",
        "Point about Chip export rules",
    ]
    linked = ai_points[0]["items"][0]
    assert linked["title"] == "New model released"
    assert linked["source"] == "AI News"
    item = client.get(f"{PREFIX}/api/items/{linked['id']}").json()
    assert item["title"] == "New model released"


def test_each_section_gets_summaries_and_the_top_articles(
    client: TestClient, model: FakeLanguageModel
) -> None:
    written(client)

    ai = model.sections[0]
    assert ai.folder_name == "AI"
    assert [item.summary for item in ai.items] == [
        "Summary of New model released",
        "Summary of Chip export rules",
    ]
    # The second article couldn't be extracted; its line still went in.
    assert [item.full_text for item in ai.items] == ["The full article.", None]


def test_a_section_is_cut_to_fit_the_token_budget(
    tmp_path: Path,
    clock: FakeClock,
    model: FakeLanguageModel,
    extractor: FakeArticleExtractor,
) -> None:
    fetcher = FakeFeedFetcher()
    fetcher.answers[AI_FEED] = rss(
        *(
            (f"Story number {n}", f"https://ai.example/{n}", hours_ago(clock, n / 10))
            for n in range(1, 41)
        )
    )
    small = build(tmp_path, clock, fetcher, model, extractor, RSS_NEWS_BRIEFING_TOKEN_BUDGET="1200")

    written(signed_in(small))

    given = [item.title for item in model.sections[0].items]
    assert 1 < len(given) < 40
    # Equal Importance, so the newest Items are the ones kept.
    assert given == [f"Story number {n}" for n in range(1, len(given) + 1)]
    assert all(item.full_text is None for item in model.sections[0].items)


def test_points_only_link_items_the_section_was_given(
    client: TestClient, model: FakeLanguageModel
) -> None:
    def invented_ids(section: SectionRequest) -> SectionResult:
        real = section.items[0].id
        return SectionResult(
            [WrittenPoint("Mixed", [real, 99_999])], FakeLanguageModel.SECTION_USAGE
        )

    model.section_answer = invented_ids

    briefing = written(client)["briefing"]

    assert [len(point["items"]) for point in briefing["sections"][0]["points"]] == [1]


def test_every_section_call_is_in_the_ledger_and_the_briefing_has_its_cost(
    client: TestClient, wiring: Wiring
) -> None:
    briefing = written(client)["briefing"]

    costs = briefing_calls(wiring)
    assert len(costs) == 2
    assert Decimal(briefing["cost_usd"]) == sum(costs, Decimal(0)).quantize(Decimal("0.01"))


def test_the_latest_briefing_is_the_one_just_written(client: TestClient) -> None:
    briefing = written(client)["briefing"]

    assert client.get(f"{BRIEFINGS}/latest").json() == {"briefing": briefing}


def test_asking_again_the_same_day_gives_the_saved_briefing(
    client: TestClient, model: FakeLanguageModel, clock: FakeClock
) -> None:
    first = written(client)["briefing"]
    calls = len(model.sections)
    # 12:00 UTC is 20:00 in Kuala Lumpur; three hours on is still the same day there.
    clock.advance(timedelta(hours=3))

    streamed = events(client)

    assert streamed == [("briefing", {"briefing": first, "reused": True})]
    assert len(model.sections) == calls


def test_a_new_day_writes_a_new_briefing(
    client: TestClient, model: FakeLanguageModel, clock: FakeClock
) -> None:
    first = written(client)["briefing"]
    # Past midnight in Kuala Lumpur.
    clock.advance(timedelta(hours=5))

    second = written(client)

    assert second["reused"] is False
    assert second["briefing"]["id"] != first["id"]


def test_regenerate_writes_a_new_briefing_the_same_day(
    client: TestClient, model: FakeLanguageModel
) -> None:
    first = written(client)["briefing"]

    again = written(client, regenerate=True)

    assert again["reused"] is False
    assert again["briefing"]["id"] != first["id"]
    assert len(model.sections) == 4
    assert client.get(f"{BRIEFINGS}/latest").json()["briefing"]["id"] == again["briefing"]["id"]


def test_a_failed_section_saves_nothing_but_keeps_the_cost(
    client: TestClient, wiring: Wiring, model: FakeLanguageModel
) -> None:
    model.failing_folders = {"World"}

    name, failure = events(client)[-1]

    assert name == "failed"
    assert failure["detail"] == (
        "The Briefing couldn't be written, and nothing was saved: scripted refusal."
    )
    assert client.get(f"{BRIEFINGS}/latest").json() == {"briefing": None}
    # The AI section and the refused World section were both billed.
    assert len(briefing_calls(wiring)) == 2


def test_after_a_failure_asking_again_writes_it(
    client: TestClient, model: FakeLanguageModel
) -> None:
    model.failing_folders = {"World"}
    events(client)
    model.failing_folders = set()

    assert written(client)["reused"] is False
