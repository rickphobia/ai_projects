"""Alert rules through the tick: which scored Items send an Alert, one per Item, quiet hours and
the daily cap in the owner's time zone, and the limits shown in the Alert set-up.

The fake clock starts at 12:00 UTC, which is 20:00 in Kuala Lumpur, the default time zone.
"""

import sqlite3
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from email.utils import format_datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rss_news.adapters.sqlite.database import MIGRATIONS, to_db_time
from rss_news.alerts.push import Alert
from rss_news.config import Settings, load_settings
from rss_news.scoring.item_scoring import ItemScore, ScoringResult, UnscoredItem
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.sources.fetching import Fetched
from rss_news.spending.ledger import AiUsage, Feature
from rss_news.wiring import Wiring
from tests.scoring.scored_feeds import inbox, titles
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    FakePushSender,
    app_env,
    make_wiring,
)

PUSH = f"{PREFIX}/api/push"
FEED = "https://news.example/rss"
PHONE = "https://fcm.googleapis.com/fcm/send/phone-token"
STARTER = (StarterFolder("News", (StarterSource("News", FEED),)),)
# Long enough for the feed to be due again.
NEXT_FETCH = timedelta(minutes=16)


def score_by_title(items: Sequence[UnscoredItem]) -> ScoringResult:
    """'Story <n> ...' gets Importance n; a title naming Nvidia mentions NVDA."""
    scores = [
        ItemScore(
            item.id,
            int(item.title.split()[1]),
            f"Summary of {item.title}",
            ("NVDA",) if "Nvidia" in item.title else (),
        )
        for item in items
    ]
    return ScoringResult(scores, FakeLanguageModel.USAGE)


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def fetcher() -> FakeFeedFetcher:
    return FakeFeedFetcher()


@pytest.fixture
def sender() -> FakePushSender:
    return FakePushSender()


@pytest.fixture
def env(tmp_path: Path) -> dict[str, str]:
    return app_env(tmp_path)


@pytest.fixture
def settings(env: dict[str, str]) -> Settings:
    return load_settings(env)


def build(
    settings: Settings, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> Wiring:
    model = FakeLanguageModel()
    model.answer = score_by_title
    return make_wiring(
        settings,
        clock,
        feed_fetcher=fetcher,
        language_model=model,
        push_sender=sender,
        starter_folders=STARTER,
    )


@pytest.fixture
def wiring(
    settings: Settings, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> Wiring:
    return build(settings, clock, fetcher, sender)


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


@pytest.fixture
def phone_on(client: TestClient) -> None:
    keys = {"p256dh": "BPhoneKey", "auth": "a"}
    response = client.post(f"{PUSH}/subscriptions", json={"endpoint": PHONE, "keys": keys})
    assert response.status_code == 204


@pytest.fixture
def watching_nvda(client: TestClient) -> None:
    response = client.post(f"{PREFIX}/api/stocks/watchlist", json={"ticker": "NVDA"})
    assert response.status_code < 300


def arrive(wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher, *story_titles: str) -> None:
    """The feed now holds these stories, and a tick fetches and scores the new ones. Each
    story's link comes from its title, so a story already fetched is a duplicate."""
    entries = "".join(
        f"<item><title>{title}</title><link>https://news.example/{title.replace(' ', '-')}"
        f"</link><pubDate>{format_datetime(clock.now(), usegmt=True)}</pubDate></item>"
        for title in story_titles
    )
    body = f'<rss version="2.0"><channel><title>t</title>{entries}</channel></rss>'
    fetcher.answers[FEED] = Fetched(
        body.encode(), "application/rss+xml", etag=None, last_modified=None
    )
    wiring.tick.run()


def alerts(sender: FakePushSender) -> list[Alert]:
    return [alert for _, alert in sender.delivered]


def at_local(clock: FakeClock, hour: int, minute: int = 0, *, day: int = 12) -> None:
    """Move the clock to this time of day in Kuala Lumpur (UTC+8) on 2026-10-<day>."""
    target = datetime(2026, 10, day, hour, minute, tzinfo=UTC) - timedelta(hours=8)
    assert target >= clock.now(), "the fake clock only moves forward"
    clock.advance(target - clock.now())


@pytest.mark.usefixtures("phone_on", "watching_nvda")
def test_items_mentioning_a_watchlist_stock_or_with_importance_5_send_an_alert(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    sender: FakePushSender,
) -> None:
    arrive(wiring, clock, fetcher, "Story 2 Nvidia earnings", "Story 5 war", "Story 4 rates")

    sent = alerts(sender)
    by_title = {item["title"]: item["id"] for item in inbox(client)}
    assert sorted(alert.item_id for alert in sent if alert.item_id is not None) == sorted(
        [by_title["Story 2 Nvidia earnings"], by_title["Story 5 war"]]
    )
    stock_alert = next(
        alert for alert in sent if alert.item_id == by_title["Story 2 Nvidia earnings"]
    )
    assert stock_alert.title == "NVDA: Story 2 Nvidia earnings"
    assert stock_alert.body == "Summary of Story 2 Nvidia earnings"


@pytest.mark.usefixtures("phone_on", "watching_nvda")
def test_an_item_matching_both_rules_sends_one_alert_and_only_once(
    wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> None:
    arrive(wiring, clock, fetcher, "Story 5 Nvidia halted")
    clock.advance(NEXT_FETCH)
    wiring.tick.run()

    assert [alert.title for alert in alerts(sender)] == ["NVDA: Story 5 Nvidia halted"]


@pytest.mark.usefixtures("phone_on")
def test_alerts_blocked_by_quiet_hours_are_dropped_but_the_item_stays_in_the_inbox(
    client: TestClient,
    wiring: Wiring,
    clock: FakeClock,
    fetcher: FakeFeedFetcher,
    sender: FakePushSender,
) -> None:
    at_local(clock, 23, 30)
    arrive(wiring, clock, fetcher, "Story 5 night news")
    at_local(clock, 7, 0, day=13)
    arrive(wiring, clock, fetcher, "Story 5 morning news", "Story 5 night news")

    assert [alert.title for alert in alerts(sender)] == ["Story 5 morning news"]
    assert "Story 5 night news" in titles(inbox(client))


@pytest.mark.usefixtures("phone_on")
def test_quiet_hours_end_at_their_end_time_not_before(
    wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> None:
    at_local(clock, 6, 59, day=13)
    arrive(wiring, clock, fetcher, "Story 5 just before seven")

    assert alerts(sender) == []


def test_alerts_past_the_daily_cap_are_dropped(
    tmp_path: Path, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> None:
    wiring = build(
        load_settings(app_env(tmp_path, RSS_NEWS_ALERT_DAILY_CAP="2")), clock, fetcher, sender
    )
    subscribe(wiring)
    arrive(wiring, clock, fetcher, "Story 5 one", "Story 5 two", "Story 5 three")
    clock.advance(NEXT_FETCH)
    arrive(wiring, clock, fetcher, "Story 5 four")
    clock.advance(NEXT_FETCH)
    wiring.tick.run()

    assert len(alerts(sender)) == 2


def test_the_daily_cap_starts_again_at_midnight_in_the_owners_time_zone(
    tmp_path: Path, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> None:
    wiring = build(
        load_settings(
            app_env(
                tmp_path, RSS_NEWS_ALERT_DAILY_CAP="1", RSS_NEWS_ALERT_QUIET_HOURS="03:00-04:00"
            )
        ),
        clock,
        fetcher,
        sender,
    )
    subscribe(wiring)
    at_local(clock, 23, 50)
    arrive(wiring, clock, fetcher, "Story 5 late")
    # 23:59 local is still the same day there, though UTC moved on long ago.
    at_local(clock, 23, 59)
    arrive(wiring, clock, fetcher, "Story 5 later", "Story 5 late")
    at_local(clock, 0, 10, day=13)
    arrive(wiring, clock, fetcher, "Story 5 new day", "Story 5 later", "Story 5 late")

    assert [alert.title for alert in alerts(sender)] == ["Story 5 late", "Story 5 new day"]


def test_alerts_keep_working_at_the_spending_limit(
    tmp_path: Path, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> None:
    wiring = build(
        load_settings(app_env(tmp_path, RSS_NEWS_MONTHLY_LIMIT_USD="1")), clock, fetcher, sender
    )
    subscribe(wiring)
    wiring.ledger.record(
        Feature.BRIEFINGS,
        AiUsage("claude-opus-5-5", 1_000_000, 0, 0, timedelta(seconds=1)),
    )

    arrive(wiring, clock, fetcher, "Story 5 big news")

    assert [alert.title for alert in alerts(sender)] == ["Story 5 big news"]


def test_without_a_phone_nothing_is_sent_and_the_cap_is_not_used_up(
    tmp_path: Path, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> None:
    wiring = build(
        load_settings(app_env(tmp_path, RSS_NEWS_ALERT_DAILY_CAP="1")), clock, fetcher, sender
    )
    arrive(wiring, clock, fetcher, "Story 5 nobody listening")
    subscribe(wiring)
    clock.advance(NEXT_FETCH)
    arrive(wiring, clock, fetcher, "Story 5 phone on", "Story 5 nobody listening")

    assert [alert.title for alert in alerts(sender)] == ["Story 5 phone on"]


def test_without_a_vapid_key_the_tick_still_succeeds(
    settings: Settings, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    wiring = make_wiring(
        settings, clock, feed_fetcher=fetcher, alerts_off=True, starter_folders=STARTER
    )
    arrive(wiring, clock, fetcher, "Story 5 big news")

    assert wiring.tick.last_success() == clock.now()


def test_items_scored_before_alert_rules_existed_send_no_alert(
    settings: Settings, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> None:
    before_alert_rules = MIGRATIONS.index(next(m for m in MIGRATIONS if "items_alert" in m))
    now = to_db_time(clock.now())
    with sqlite3.connect(settings.database_path) as connection:
        connection.executescript(
            "".join(MIGRATIONS[:before_alert_rules])
            + f"PRAGMA user_version = {before_alert_rules};"
        )
        connection.execute("INSERT INTO folders (id, name, position) VALUES (1, 'News', 0)")
        connection.execute(
            "INSERT INTO sources (id, folder_id, name, url) VALUES (1, 1, 'News', ?)", (FEED,)
        )
        connection.execute(
            "INSERT INTO items (source_id, title, url, clean_url, excerpt, published_at, "
            "fetched_at, importance, summary, scored_at) "
            "VALUES (1, 'Story 5 old', 'https://news.example/old', 'https://news.example/old', "
            "'', ?, ?, 5, 'Old summary', ?)",
            (now, now, now),
        )

    wiring = build(settings, clock, fetcher, sender)
    subscribe(wiring)
    arrive(wiring, clock, fetcher, "Story 5 new")

    assert [alert.title for alert in alerts(sender)] == ["Story 5 new"]


def test_the_setup_shows_the_quiet_hours_and_the_daily_cap(client: TestClient) -> None:
    setup = client.get(PUSH).json()

    assert setup["quiet_hours"] == {"start": "23:00", "end": "07:00"}
    assert setup["daily_cap"] == 10


def subscribe(wiring: Wiring) -> None:
    client = TestClient(wiring.app)
    client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})
    keys = {"p256dh": "BPhoneKey", "auth": "a"}
    response = client.post(f"{PUSH}/subscriptions", json={"endpoint": PHONE, "keys": keys})
    assert response.status_code == 204
