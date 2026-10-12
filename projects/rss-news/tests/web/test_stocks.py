"""The owner's stocks over the API: the Watchlist and its ticker validation, Holdings, the
ticker-news Source kept per stock, and the stocks scoring marks on each Item."""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.config import Settings, load_settings
from rss_news.scoring.item_scoring import ItemScore, ScoringResult, UnscoredItem
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.wiring import Wiring
from tests.scoring.scored_feeds import feed
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    app_env,
    make_wiring,
)

STOCKS = f"{PREFIX}/api/stocks"
WATCHLIST = f"{STOCKS}/watchlist"
MARKETS_FEED = "https://markets.example/rss"
NVDA_FEED = "https://feeds.finance.yahoo.com/rss/2.0/headline?s=NVDA&region=US&lang=en-US"
STARTER = (
    StarterFolder("Markets", (StarterSource("Markets", MARKETS_FEED),)),
    StarterFolder("Stocks", (StarterSource("CNBC Markets", "https://cnbc.example/rss"),)),
)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return load_settings(app_env(tmp_path))


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


def ticker_sources(client: TestClient) -> dict[str, Any]:
    """Each Source in the Stocks Folder by name."""
    folders = client.get(f"{PREFIX}/api/folders").json()["folders"]
    (stocks_folder,) = [folder for folder in folders if folder["name"] == "Stocks"]
    sources = client.get(f"{PREFIX}/api/sources").json()["sources"]
    return {
        source["name"]: source for source in sources if source["folder_id"] == stocks_folder["id"]
    }


def test_the_watchlist_starts_empty_and_holdings_are_read_only(client: TestClient) -> None:
    assert client.get(STOCKS).json() == {"holdings": [], "watchlist": []}
    assert client.post(f"{STOCKS}/holdings", json={"ticker": "NVDA"}).status_code in (404, 405)


@pytest.mark.parametrize(("typed", "kept"), [("nvda", "NVDA"), ("1155.kl", "1155.KL")])
def test_us_and_bursa_tickers_are_added_to_the_watchlist(
    client: TestClient, clock: FakeClock, typed: str, kept: str
) -> None:
    response = client.post(WATCHLIST, json={"ticker": typed})

    assert response.status_code == 201
    assert response.json() == {"ticker": kept, "added_at": clock.now().isoformat()}
    assert [stock["ticker"] for stock in client.get(STOCKS).json()["watchlist"]] == [kept]


@pytest.mark.parametrize("typed", ["MAYBANK.KL", "1155", "NV DA", "TOOLONG"])
def test_a_ticker_in_neither_form_is_refused_with_a_reason(client: TestClient, typed: str) -> None:
    response = client.post(WATCHLIST, json={"ticker": typed})

    assert response.status_code == 422
    assert "1155.KL" in response.json()["detail"]
    assert client.get(STOCKS).json()["watchlist"] == []


def test_adding_a_ticker_twice_is_refused(client: TestClient) -> None:
    client.post(WATCHLIST, json={"ticker": "NVDA"})

    response = client.post(WATCHLIST, json={"ticker": "nvda"})

    assert response.status_code == 409
    assert response.json() == {"detail": "NVDA is on the Watchlist already"}


def test_a_watched_stock_gets_a_ticker_news_source_in_the_stocks_folder(
    client: TestClient,
) -> None:
    client.post(WATCHLIST, json={"ticker": "NVDA"})
    client.post(WATCHLIST, json={"ticker": "1155.KL"})

    sources = ticker_sources(client)

    assert sources["NVDA news"]["url"] == NVDA_FEED
    assert sources["1155.KL news"]["url"] == (
        "https://feeds.finance.yahoo.com/rss/2.0/headline?s=1155.KL&region=US&lang=en-US"
    )
    assert "CNBC Markets" in sources


def test_the_stocks_folder_is_created_when_the_owner_has_none(
    settings: Settings, clock: FakeClock
) -> None:
    starter = (StarterFolder("Markets", (StarterSource("Markets", MARKETS_FEED),)),)
    client = TestClient(make_wiring(settings, clock, starter_folders=starter).app)
    client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})

    client.post(WATCHLIST, json={"ticker": "NVDA"})

    assert list(ticker_sources(client)) == ["NVDA news"]


def test_removing_a_watched_stock_removes_its_source_and_items(
    client: TestClient, clock: FakeClock, fetcher: FakeFeedFetcher, wiring: Wiring
) -> None:
    client.post(WATCHLIST, json={"ticker": "NVDA"})
    fetcher.answers[NVDA_FEED] = feed(clock, "Nvidia 4 beats estimates")
    wiring.tick.run()
    assert len(client.get(f"{PREFIX}/api/inbox").json()["items"]) == 1

    response = client.delete(f"{WATCHLIST}/nvda")

    assert response.status_code == 204
    assert client.get(STOCKS).json()["watchlist"] == []
    assert "NVDA news" not in ticker_sources(client)
    assert client.get(f"{PREFIX}/api/inbox").json()["items"] == []


def test_removing_a_stock_not_on_the_watchlist_is_a_404(client: TestClient) -> None:
    response = client.delete(f"{WATCHLIST}/NVDA")

    assert response.status_code == 404
    assert response.json() == {"detail": "NVDA isn't on the Watchlist"}


def test_a_holding_keeps_its_source_until_it_leaves_both_lists(
    client: TestClient, wiring: Wiring
) -> None:
    wiring.stocks.replace_holdings(["NVDA"])
    client.post(WATCHLIST, json={"ticker": "NVDA"})
    assert client.get(STOCKS).json()["holdings"] == [{"ticker": "NVDA"}]

    client.delete(f"{WATCHLIST}/NVDA")
    assert "NVDA news" in ticker_sources(client)

    wiring.stocks.replace_holdings([])
    assert "NVDA news" not in ticker_sources(client)


def test_a_ticker_source_deleted_by_hand_comes_back_after_a_restart(
    client: TestClient, settings: Settings, clock: FakeClock
) -> None:
    client.post(WATCHLIST, json={"ticker": "NVDA"})
    client.delete(f"{PREFIX}/api/sources/{ticker_sources(client)['NVDA news']['id']}")

    restarted = TestClient(make_wiring(settings, clock, starter_folders=STARTER).app)
    restarted.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})

    assert "NVDA news" in ticker_sources(restarted)


def test_scoring_marks_the_owners_stocks_each_item_mentions(
    client: TestClient,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
    wiring: Wiring,
) -> None:
    client.post(WATCHLIST, json={"ticker": "NVDA"})
    client.post(WATCHLIST, json={"ticker": "1155.KL"})

    def mentions_by_title(items: Sequence[UnscoredItem]) -> ScoringResult:
        # The model answers in any case and names stocks the owner doesn't have; only the
        # owner's are kept.
        stocks = {
            "Chips 4 Nvidia and Maybank": ("nvda", "1155.KL", "AMD"),
            "Weather 2 calm": (),
        }
        return ScoringResult(
            [ItemScore(item.id, 3, "s", stocks[item.title]) for item in items],
            FakeLanguageModel.USAGE,
        )

    language_model.answer = mentions_by_title
    fetcher.answers[MARKETS_FEED] = feed(clock, "Chips 4 Nvidia and Maybank", "Weather 2 calm")

    wiring.tick.run()

    assert language_model.tickers_given == [["1155.KL", "NVDA"]]
    items = client.get(f"{PREFIX}/api/inbox").json()["items"]
    stocks = {item["title"]: item["stocks"] for item in items}
    assert stocks == {"Chips 4 Nvidia and Maybank": ["1155.KL", "NVDA"], "Weather 2 calm": []}
    (mentioning,) = [item for item in items if item["stocks"]]
    assert client.get(f"{PREFIX}/api/items/{mentioning['id']}").json()["stocks"] == [
        "1155.KL",
        "NVDA",
    ]


def test_unscored_items_mention_no_stocks(
    client: TestClient,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    language_model: FakeLanguageModel,
    wiring: Wiring,
) -> None:
    language_model.unavailable = True
    fetcher.answers[MARKETS_FEED] = feed(clock, "Chips 4 Nvidia")

    wiring.tick.run()

    (item,) = client.get(f"{PREFIX}/api/inbox").json()["items"]
    assert item["stocks"] == []
