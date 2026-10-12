"""Briefing scopes and history: one Folder, 7 and 30 day windows with the Importance cut-off,
picked Items, and the saved Briefings list."""

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.config import load_settings
from rss_news.scoring.item_scoring import ItemScore, ScoringResult, UnscoredItem
from rss_news.sources.catalog import StarterFolder, StarterSource
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
from tests.web.test_inbox import INBOX, folder_id, hours_ago, rss

BRIEFINGS = f"{PREFIX}/api/briefings"
AI_FEED = "https://ai.example/rss"
WORLD_FEED = "https://world.example/rss"
STARTER = (
    StarterFolder("AI", (StarterSource("AI News", AI_FEED),)),
    StarterFolder("World", (StarterSource("World News", WORLD_FEED),)),
    StarterFolder("Empty", (StarterSource("Quiet", "https://quiet.example/rss"),)),
)


def minor_items_score_2(items: Sequence[UnscoredItem]) -> ScoringResult:
    scores = [
        ItemScore(item.id, 2 if "Minor" in item.title else 3, f"Summary of {item.title}")
        for item in items
    ]
    return ScoringResult(scores, FakeLanguageModel.USAGE)


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def model() -> FakeLanguageModel:
    model = FakeLanguageModel()
    model.answer = minor_items_score_2
    return model


def build(tmp_path: Path, clock: FakeClock, model: FakeLanguageModel, **env: str) -> TestClient:
    fetcher = FakeFeedFetcher()
    fetcher.answers[AI_FEED] = rss(
        ("New model released", "https://ai.example/model", hours_ago(clock, 2)),
        ("Minor AI tweak", "https://ai.example/tweak", hours_ago(clock, 50)),
        ("Chip export rules", "https://ai.example/chips", hours_ago(clock, 4 * 24)),
        ("Old benchmark", "https://ai.example/old", hours_ago(clock, 10 * 24)),
    )
    fetcher.answers[WORLD_FEED] = rss(
        ("Ceasefire agreed", "https://world.example/ceasefire", hours_ago(clock, 1)),
        ("Minor world note", "https://world.example/note", hours_ago(clock, 3 * 24)),
    )
    wiring: Wiring = make_wiring(
        load_settings(app_env(tmp_path, **env)),
        clock,
        feed_fetcher=fetcher,
        language_model=model,
        article_extractor=FakeArticleExtractor(),
        starter_folders=STARTER,
    )
    wiring.tick.run()
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


@pytest.fixture
def client(tmp_path: Path, clock: FakeClock, model: FakeLanguageModel) -> TestClient:
    return build(tmp_path, clock, model)


def written(client: TestClient, **body: Any) -> dict[str, Any]:
    response = client.post(BRIEFINGS, json=body)
    assert response.status_code == 200, response.text
    name_line, data_line = response.text.strip().split("\n\n")[-1].split("\n")
    assert name_line == "event: briefing", data_line
    data: dict[str, Any] = json.loads(data_line.removeprefix("data: "))
    return data


def given_titles(model: FakeLanguageModel) -> list[str]:
    return [item.title for section in model.sections for item in section.items]


def item_id(client: TestClient, title: str) -> int:
    items = client.get(INBOX).json()["items"]
    return int(next(item["id"] for item in items if item["title"] == title))


def test_24_hours_reads_every_item_whatever_its_importance(
    tmp_path: Path, clock: FakeClock, model: FakeLanguageModel
) -> None:
    def all_score_1(items: Sequence[UnscoredItem]) -> ScoringResult:
        scores = [ItemScore(item.id, 1, f"Summary of {item.title}") for item in items]
        return ScoringResult(scores, FakeLanguageModel.USAGE)

    model.answer = all_score_1
    client = build(tmp_path, clock, model)

    briefing = written(client)["briefing"]

    assert briefing["scope"] == "all-24h"
    assert briefing["title"] == "All Sources, last 24 hours"
    assert given_titles(model) == ["New model released", "Ceasefire agreed"]


def test_7_days_keeps_only_items_at_or_above_the_cutoff(
    client: TestClient, model: FakeLanguageModel
) -> None:
    briefing = written(client, window="7d")["briefing"]

    assert briefing["scope"] == "all-168h"
    assert briefing["title"] == "All Sources, last 7 days"
    assert given_titles(model) == ["New model released", "Chip export rules", "Ceasefire agreed"]


def test_30_days_reaches_further_back_with_the_same_cutoff(
    client: TestClient, model: FakeLanguageModel
) -> None:
    briefing = written(client, window="30d")["briefing"]

    assert briefing["title"] == "All Sources, last 30 days"
    assert given_titles(model) == [
        "New model released",
        "Chip export rules",
        "Old benchmark",
        "Ceasefire agreed",
    ]


def test_the_cutoff_comes_from_config(
    tmp_path: Path, clock: FakeClock, model: FakeLanguageModel
) -> None:
    client = build(tmp_path, clock, model, RSS_NEWS_BRIEFING_IMPORTANCE_CUTOFF="2")

    written(client, window="7d")

    assert "Minor AI tweak" in given_titles(model)
    assert "Minor world note" in given_titles(model)


def test_one_folder_is_briefed_alone(client: TestClient, model: FakeLanguageModel) -> None:
    ai = folder_id(client, "AI")

    briefing = written(client, window="7d", folder_id=ai)["briefing"]

    assert briefing["scope"] == f"folder-{ai}-168h"
    assert briefing["title"] == "AI, last 7 days"
    assert [section["folder"]["name"] for section in briefing["sections"]] == ["AI"]
    assert given_titles(model) == ["New model released", "Chip export rules"]


def test_the_estimate_follows_the_scope(client: TestClient) -> None:
    ai = folder_id(client, "AI")

    def estimate(**params: Any) -> dict[str, Any]:
        response = client.get(f"{BRIEFINGS}/estimate", params=params)
        assert response.status_code == 200
        result: dict[str, Any] = response.json()
        return result

    assert estimate()["item_count"] == 2
    assert estimate(window="7d")["item_count"] == 3
    assert estimate(window="30d", folder=ai) | {"estimated_cost_usd": None} == {
        "item_count": 3,
        "section_count": 1,
        "estimated_cost_usd": None,
    }
    picked = [item_id(client, "Old benchmark"), item_id(client, "Minor world note")]
    assert estimate(item=picked)["item_count"] == 2


def test_an_unknown_window_is_refused(client: TestClient) -> None:
    assert client.get(f"{BRIEFINGS}/estimate", params={"window": "1y"}).status_code == 422
    assert client.post(BRIEFINGS, json={"window": "1y"}).status_code == 422


def test_an_empty_folder_has_nothing_to_brief(client: TestClient) -> None:
    response = client.post(
        BRIEFINGS, json={"window": "7d", "folder_id": folder_id(client, "Empty")}
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "No Items were published in this Folder in the last 7 days with Importance 3 or higher."
    )


def test_picked_items_are_briefed_whatever_their_age_or_importance(
    client: TestClient, model: FakeLanguageModel
) -> None:
    picked = [item_id(client, "Minor world note"), item_id(client, "Old benchmark")]

    briefing = written(client, item_ids=picked)["briefing"]

    assert briefing["scope"] == "picked-" + ",".join(str(i) for i in sorted(picked))
    assert briefing["title"] == "2 picked Items"
    assert briefing["item_count"] == 2
    assert [section["folder"]["name"] for section in briefing["sections"]] == ["AI", "World"]
    assert given_titles(model) == ["Old benchmark", "Minor world note"]


def test_picking_the_same_items_again_today_reuses_the_briefing(
    client: TestClient, model: FakeLanguageModel
) -> None:
    picked = [item_id(client, "Minor world note"), item_id(client, "Old benchmark")]
    first = written(client, item_ids=picked)

    again = written(client, item_ids=list(reversed(picked)))

    assert again == {"briefing": first["briefing"], "reused": True}
    assert len(model.sections) == 2


def test_picked_items_that_no_longer_exist_are_refused(client: TestClient) -> None:
    response = client.post(BRIEFINGS, json={"item_ids": [99_999]})

    assert response.status_code == 422
    assert response.json()["detail"] == "None of the picked Items exist any more."


def test_an_empty_pick_is_refused(client: TestClient) -> None:
    assert client.post(BRIEFINGS, json={"item_ids": []}).status_code == 422


def test_each_scope_is_reused_on_its_own(client: TestClient) -> None:
    day = written(client)
    week = written(client, window="7d")

    assert week["reused"] is False
    assert week["briefing"]["id"] != day["briefing"]["id"]
    assert written(client)["reused"] is True


def test_saved_briefings_are_listed_newest_first_without_their_points(
    client: TestClient,
) -> None:
    day = written(client)["briefing"]
    week = written(client, window="7d")["briefing"]

    listed = client.get(BRIEFINGS).json()["briefings"]

    assert [briefing["id"] for briefing in listed] == [week["id"], day["id"]]
    assert listed[0] == {key: value for key, value in week.items() if key != "sections"}


def test_the_list_is_empty_at_first(client: TestClient) -> None:
    assert client.get(BRIEFINGS).json() == {"briefings": []}


def test_a_saved_briefing_opens_by_id(client: TestClient) -> None:
    day = written(client)["briefing"]
    written(client, window="7d")

    assert client.get(f"{BRIEFINGS}/{day['id']}").json() == {"briefing": day}


def test_an_unknown_briefing_is_not_found(client: TestClient) -> None:
    response = client.get(f"{BRIEFINGS}/99999")

    assert response.status_code == 404
    assert response.json()["detail"] == "That Briefing doesn't exist."


def test_the_list_and_a_briefing_need_a_session(client: TestClient) -> None:
    client.post(f"{PREFIX}/api/logout")

    assert client.get(BRIEFINGS).status_code == 401
    assert client.get(f"{BRIEFINGS}/1").status_code == 401
