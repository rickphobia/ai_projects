from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rss_news.adapters.sqlite.briefings import SqliteBriefings
from rss_news.adapters.sqlite.chat import SqliteChats
from rss_news.adapters.sqlite.database import SqliteDatabase
from rss_news.adapters.sqlite.items import SqliteItems
from rss_news.adapters.sqlite.login_failures import SqliteLoginFailures
from rss_news.adapters.sqlite.sources import SqliteSources
from rss_news.adapters.sqlite.spending import SqliteSpending
from rss_news.briefings.writing import Briefings
from rss_news.chat.chatting import Chats
from rss_news.config import load_settings
from rss_news.items.inbox import Inbox
from rss_news.items.reading import ItemReading
from rss_news.sources.managing import SourceManagement
from rss_news.spending.ledger import SpendingLedger
from rss_news.spending.limit import SpendingLimit
from rss_news.web.app import create_app
from rss_news.wiring import Wiring
from tests.support import (
    PREFIX,
    PWA_INDEX,
    FakeArticleExtractor,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    app_env,
    make_wiring,
)


class UnreachableDatabase:
    def is_reachable(self) -> bool:
        return False


class NeverTicked:
    def last_success(self) -> datetime | None:
        return None


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def wiring(tmp_path: Path, clock: FakeClock) -> Wiring:
    return make_wiring(load_settings(app_env(tmp_path)), clock)


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    return TestClient(wiring.app)


def test_healthz_answers_ok_under_the_path_prefix(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "last_tick_seconds_ago": None}


def test_healthz_says_how_long_ago_the_last_tick_succeeded(
    client: TestClient, wiring: Wiring, clock: FakeClock
) -> None:
    wiring.tick.run()
    clock.advance(timedelta(seconds=90))

    response = client.get(f"{PREFIX}/healthz")

    assert response.json()["last_tick_seconds_ago"] == 90


def test_healthz_fails_when_the_database_is_unreachable(tmp_path: Path) -> None:
    settings = load_settings(app_env(tmp_path))
    database = SqliteDatabase(settings.database_path)
    clock = FakeClock()
    ledger = SpendingLedger(
        SqliteSpending(database),
        clock,
        prices=settings.model_prices,
        web_search_price_usd=settings.web_search_price_usd,
    )
    limit = SpendingLimit(
        ledger, clock, timezone=settings.timezone, monthly_limit_usd=settings.monthly_limit_usd
    )
    client = TestClient(
        create_app(
            settings,
            database=UnreachableDatabase(),
            login_failures=SqliteLoginFailures(database),
            clock=clock,
            inbox=Inbox(SqliteItems(database, clock)),
            item_reading=ItemReading(
                items=SqliteItems(database, clock), extractor=FakeArticleExtractor(), clock=clock
            ),
            source_management=SourceManagement(
                sources=SqliteSources(database), fetcher=FakeFeedFetcher()
            ),
            briefings=Briefings(
                store=SqliteBriefings(database),
                model=FakeLanguageModel(),
                extractor=FakeArticleExtractor(),
                ledger=ledger,
                limit=limit,
                clock=clock,
                timezone=settings.timezone,
                model_name=settings.briefing_model,
                token_budget=settings.briefing_token_budget,
                importance_cutoff=settings.briefing_importance_cutoff,
            ),
            chats=Chats(
                store=SqliteChats(database),
                model=FakeLanguageModel(),
                ledger=ledger,
                limit=limit,
                clock=clock,
                timezone=settings.timezone,
            ),
            spending=limit,
            tick=NeverTicked(),
        )
    )

    response = client.get(f"{PREFIX}/healthz")

    assert response.status_code == 503
    assert response.json() == {
        "status": "failing",
        "database": "unreachable",
        "last_tick_seconds_ago": None,
    }


def test_the_pwa_loads_under_the_path_prefix(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/")

    assert response.status_code == 200
    assert response.text == PWA_INDEX


def test_the_pwa_assets_load_under_the_path_prefix(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/assets/main.js")

    assert response.status_code == 200
    assert "rss-news" in response.text


def test_an_unknown_file_is_not_found(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/assets/missing.js")

    assert response.status_code == 404
