"""The spending summary and the monthly limit: the month in the owner's time zone, the
warning at 80%, Briefings refused at 100%, and scoring that never stops."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rss_news.config import load_settings
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.spending.ledger import AiUsage, Feature
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
from tests.web.test_inbox import hours_ago, rss

SPENDING = f"{PREFIX}/api/spending"
BRIEFINGS = f"{PREFIX}/api/briefings"
FEED = "https://news.example/rss"
# At the default Opus price of 4 USD per million input tokens, this call costs 1 USD.
ONE_DOLLAR = AiUsage(
    model="claude-opus-5-5",
    input_tokens=250_000,
    output_tokens=0,
    web_searches=0,
    duration=timedelta(seconds=1),
)


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def model() -> FakeLanguageModel:
    return FakeLanguageModel()


@pytest.fixture
def fetcher(clock: FakeClock) -> FakeFeedFetcher:
    fetcher = FakeFeedFetcher()
    fetcher.answers[FEED] = rss(("Big news", "https://news.example/big", hours_ago(clock, 1)))
    return fetcher


@pytest.fixture
def wiring(
    tmp_path: Path, clock: FakeClock, model: FakeLanguageModel, fetcher: FakeFeedFetcher
) -> Wiring:
    return make_wiring(
        # Asia/Kuala_Lumpur is UTC+8: its month starts at 16:00 UTC the day before.
        load_settings(app_env(tmp_path, RSS_NEWS_MONTHLY_LIMIT_USD="10")),
        clock,
        feed_fetcher=fetcher,
        language_model=model,
        starter_folders=(StarterFolder("News", (StarterSource("News", FEED),)),),
    )


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


def spend(wiring: Wiring, dollars: int, feature: Feature = Feature.BRIEFINGS) -> None:
    for _ in range(dollars):
        wiring.ledger.record(feature, ONE_DOLLAR)


def test_spending_needs_a_session(wiring: Wiring) -> None:
    assert TestClient(wiring.app).get(SPENDING).status_code == 401


def test_the_summary_starts_at_zero_for_every_feature(client: TestClient) -> None:
    assert client.get(SPENDING).json() == {
        "month_start": "2026-10-01T00:00:00+08:00",
        "total_usd": "0.00",
        "limit_usd": "10.00",
        "status": "ok",
        "by_feature": {"scoring": "0.00", "briefings": "0.00"},
    }


def test_the_summary_totals_this_month_by_feature(client: TestClient, wiring: Wiring) -> None:
    spend(wiring, 2, Feature.SCORING)
    spend(wiring, 3, Feature.BRIEFINGS)

    summary = client.get(SPENDING).json()

    assert summary["total_usd"] == "5.00"
    assert summary["by_feature"] == {"scoring": "2.00", "briefings": "3.00"}


def test_the_month_starts_at_midnight_in_the_owners_time_zone(
    client: TestClient, wiring: Wiring, clock: FakeClock
) -> None:
    clock.current = datetime(2026, 9, 30, 15, 59, tzinfo=UTC)  # 23:59 on 30 Sep in KL
    spend(wiring, 1)
    clock.current = datetime(2026, 9, 30, 16, 0, tzinfo=UTC)  # 00:00 on 1 Oct in KL
    spend(wiring, 2)
    clock.current = FakeClock().current

    summary = client.get(SPENDING).json()

    assert summary["month_start"] == "2026-10-01T00:00:00+08:00"
    assert summary["total_usd"] == "2.00"


def test_the_status_warns_from_80_percent(client: TestClient, wiring: Wiring) -> None:
    spend(wiring, 7)
    assert client.get(SPENDING).json()["status"] == "ok"

    spend(wiring, 1)

    assert client.get(SPENDING).json()["status"] == "warning"


def test_briefings_are_refused_at_the_limit_without_calling_the_model(
    client: TestClient, wiring: Wiring, model: FakeLanguageModel
) -> None:
    wiring.tick.run()
    spend(wiring, 10)

    response = client.post(BRIEFINGS, json={})

    assert client.get(SPENDING).json()["status"] == "stopped"
    assert response.status_code == 429
    assert "reached the $10.00 limit" in response.json()["detail"]
    assert model.sections == []


def test_scoring_keeps_running_at_the_limit(wiring: Wiring, model: FakeLanguageModel) -> None:
    spend(wiring, 10)

    wiring.tick.run()

    assert len(model.calls) == 1
