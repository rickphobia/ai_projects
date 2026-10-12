"""Feeds arriving in the Inbox: the tick fetches through the fake FeedFetcher, the API lists."""

import logging
from datetime import timedelta
from email.utils import format_datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.config import Settings, load_settings
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.sources.fetching import Fetched, FetchFailed, NotModified
from rss_news.wiring import Wiring
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    app_env,
    make_wiring,
)

INBOX = f"{PREFIX}/api/inbox"
FOLDERS = f"{PREFIX}/api/folders"
FEEDS = Path(__file__).parent.parent / "sources" / "feeds"

WORLD_FEED = "https://world.example/rss"
AI_FEED = "https://ai.example/rss"
TECH_FEED = "https://tech.example/rss"

STARTER = (
    StarterFolder("AI", (StarterSource("AI News", AI_FEED),)),
    StarterFolder("World", (StarterSource("World News", WORLD_FEED),)),
    StarterFolder("Tech", (StarterSource("Tech News", TECH_FEED),)),
)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return load_settings(app_env(tmp_path, RSS_NEWS_FETCH_INTERVAL_MINUTES="15"))


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def fetcher() -> FakeFeedFetcher:
    return FakeFeedFetcher()


@pytest.fixture
def wiring(settings: Settings, clock: FakeClock, fetcher: FakeFeedFetcher) -> Wiring:
    return make_wiring(settings, clock, feed_fetcher=fetcher, starter_folders=STARTER)


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


def rss(*items: tuple[str, str, str | None]) -> Fetched:
    """A feed answer with (title, link, published as RFC 822 or None) items."""
    entries = "".join(
        f"<item><title>{title}</title><link>{link.replace('&', '&amp;')}</link>"
        + (f"<pubDate>{published}</pubDate>" if published else "")
        + "</item>"
        for title, link, published in items
    )
    body = f'<rss version="2.0"><channel><title>t</title>{entries}</channel></rss>'
    return Fetched(body.encode(), "application/rss+xml", etag=None, last_modified=None)


def hours_ago(clock: FakeClock, hours: float) -> str:
    return format_datetime(clock.now() - timedelta(hours=hours), usegmt=True)


def titles(page: dict[str, Any]) -> list[str]:
    return [item["title"] for item in page["items"]]


def folder_id(client: TestClient, name: str) -> int:
    folders = client.get(FOLDERS).json()["folders"]
    return int(next(folder["id"] for folder in folders if folder["name"] == name))


def test_the_starter_folders_are_listed_in_order(client: TestClient) -> None:
    response = client.get(FOLDERS)

    assert response.status_code == 200
    assert [folder["name"] for folder in response.json()["folders"]] == ["AI", "World", "Tech"]


def test_the_starter_sources_load_on_first_run_only(
    settings: Settings, clock: FakeClock, fetcher: FakeFeedFetcher, wiring: Wiring
) -> None:
    changed_starter = (StarterFolder("Elsewhere", (StarterSource("New", "https://new/rss"),)),)

    restarted = make_wiring(settings, clock, feed_fetcher=fetcher, starter_folders=changed_starter)
    restarted.tick.run()

    assert sorted(request.url for request in fetcher.requests) == [AI_FEED, TECH_FEED, WORLD_FEED]


def test_the_inbox_lists_fetched_items_newest_first_with_source_and_folder(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss(
        ("Older world story", "https://world.example/older", hours_ago(clock, 3)),
        ("Newest world story", "https://world.example/newest", hours_ago(clock, 1)),
    )
    fetcher.answers[AI_FEED] = rss(
        ("Middle AI story", "https://ai.example/middle", hours_ago(clock, 2))
    )

    wiring.tick.run()
    page = client.get(INBOX).json()

    assert titles(page) == ["Newest world story", "Middle AI story", "Older world story"]
    newest = page["items"][0]
    assert newest["url"] == "https://world.example/newest"
    assert newest["source"] == "World News"
    assert newest["folder"]["name"] == "World"
    assert newest["published_at"] == (clock.now() - timedelta(hours=1)).isoformat()
    assert page["next_cursor"] is None


def test_the_inbox_filters_by_folder(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss(("World story", "https://world.example/a", None))
    fetcher.answers[AI_FEED] = rss(("AI story", "https://ai.example/a", None))
    wiring.tick.run()

    page = client.get(INBOX, params={"folder": folder_id(client, "AI")}).json()

    assert titles(page) == ["AI story"]


def test_the_same_story_with_different_tracking_parameters_is_stored_once(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss(
        ("Big story", "https://news.example/big?utm_source=world&utm_medium=rss", None)
    )
    fetcher.answers[AI_FEED] = rss(
        ("Big story, again", "https://news.example/big?fbclid=xyz&at_campaign=ai", None)
    )

    wiring.tick.run()

    assert len(client.get(INBOX).json()["items"]) == 1


def test_an_item_fetched_again_on_a_later_tick_is_not_stored_twice(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss(("Story", "https://world.example/story", None))
    wiring.tick.run()
    clock.advance(timedelta(minutes=15))
    fetcher.answers[WORLD_FEED] = rss(
        ("Story", "https://world.example/story", None),
        ("Next story", "https://world.example/next", None),
    )

    wiring.tick.run()

    assert sorted(titles(client.get(INBOX).json())) == ["Next story", "Story"]


def test_saved_feeds_from_each_family_arrive_in_the_inbox(
    client: TestClient, wiring: Wiring, fetcher: FakeFeedFetcher
) -> None:
    def saved(name: str) -> Fetched:
        return Fetched((FEEDS / name).read_bytes(), "application/xml", None, None)

    fetcher.answers[WORLD_FEED] = saved("bbc-world.rss.xml")
    fetcher.answers[AI_FEED] = saved("reddit-localllama.atom.xml")
    fetcher.answers[TECH_FEED] = saved("simon-willison.atom.xml")

    wiring.tick.run()
    items = client.get(INBOX, params={"limit": 50}).json()["items"]

    assert len(items) == 9
    bbc = [item for item in items if item["source"] == "World News"]
    assert all("at_medium" in item["url"] for item in bbc)


def test_sources_are_not_fetched_again_until_the_interval_has_passed(
    wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    wiring.tick.run()
    clock.advance(timedelta(minutes=14))
    wiring.tick.run()
    assert len(fetcher.requests) == 3

    clock.advance(timedelta(minutes=1))
    wiring.tick.run()

    assert len(fetcher.requests) == 6


def test_the_caching_headers_of_the_last_answer_are_sent_next_time(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = Fetched(
        rss(("Story", "https://world.example/story", None)).body,
        "application/rss+xml",
        etag='"v1"',
        last_modified="Mon, 12 Oct 2026 08:00:00 GMT",
    )
    wiring.tick.run()
    fetcher.answers[WORLD_FEED] = NotModified()
    clock.advance(timedelta(minutes=15))
    fetcher.requests.clear()

    wiring.tick.run()

    (world,) = [request for request in fetcher.requests if request.url == WORLD_FEED]
    assert world.etag == '"v1"'
    assert world.last_modified == "Mon, 12 Oct 2026 08:00:00 GMT"
    assert titles(client.get(INBOX).json()) == ["Story"]


def test_a_failing_source_is_logged_and_the_others_still_arrive(
    client: TestClient,
    wiring: Wiring,
    fetcher: FakeFeedFetcher,
    caplog: pytest.LogCaptureFixture,
) -> None:
    fetcher.answers[AI_FEED] = FetchFailed("http status", "answered 503")
    fetcher.answers[WORLD_FEED] = Fetched(b"<html>not a feed</html>", "text/html", None, None)
    fetcher.answers[TECH_FEED] = rss(("Tech story", "https://tech.example/a", None))

    with caplog.at_level(logging.WARNING):
        wiring.tick.run()

    assert titles(client.get(INBOX).json()) == ["Tech story"]
    failures = {
        record.__dict__["source"]: record.__dict__["step"]
        for record in caplog.records
        if record.getMessage() == "source fetch failed"
    }
    assert failures == {"AI News": "http status", "World News": "parse"}
    assert client.get(f"{PREFIX}/healthz").json()["last_tick_seconds_ago"] == 0


def test_a_future_dated_item_counts_as_arriving_now(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss(
        ("From the future", "https://world.example/future", hours_ago(clock, -48))
    )

    wiring.tick.run()

    (item,) = client.get(INBOX).json()["items"]
    assert item["published_at"] == clock.now().isoformat()


def test_the_inbox_pages_through_every_item_once(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss(
        *[
            (f"Story {number}", f"https://world.example/{number}", hours_ago(clock, number))
            for number in range(5)
        ]
    )
    wiring.tick.run()

    first = client.get(INBOX, params={"limit": 2}).json()
    second = client.get(INBOX, params={"limit": 2, "cursor": first["next_cursor"]}).json()
    third = client.get(INBOX, params={"limit": 2, "cursor": second["next_cursor"]}).json()

    assert titles(first) == ["Story 0", "Story 1"]
    assert titles(second) == ["Story 2", "Story 3"]
    assert titles(third) == ["Story 4"]
    assert third["next_cursor"] is None


def test_paging_by_folder_stays_in_the_folder(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss(
        ("World 1", "https://world.example/1", hours_ago(clock, 1)),
        ("World 3", "https://world.example/3", hours_ago(clock, 3)),
    )
    fetcher.answers[AI_FEED] = rss(("AI 2", "https://ai.example/2", hours_ago(clock, 2)))
    wiring.tick.run()
    world = folder_id(client, "World")

    first = client.get(INBOX, params={"folder": world, "limit": 1}).json()
    second = client.get(
        INBOX, params={"folder": world, "limit": 1, "cursor": first["next_cursor"]}
    ).json()

    assert titles(first) + titles(second) == ["World 1", "World 3"]


def test_a_cursor_works_pasted_into_a_url_by_hand(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss(
        ("First", "https://world.example/1", hours_ago(clock, 1)),
        ("Second", "https://world.example/2", hours_ago(clock, 2)),
    )
    wiring.tick.run()
    cursor = client.get(INBOX, params={"limit": 1}).json()["next_cursor"]

    second = client.get(f"{INBOX}?limit=1&cursor={cursor}").json()

    assert titles(second) == ["Second"]


def test_a_cursor_the_inbox_did_not_hand_out_is_refused(client: TestClient) -> None:
    response = client.get(INBOX, params={"cursor": "not-a-cursor"})

    assert response.status_code == 400
    assert "not an Inbox cursor" in response.json()["detail"]


def test_the_inbox_and_folders_need_a_session(wiring: Wiring) -> None:
    signed_out = TestClient(wiring.app)

    assert signed_out.get(INBOX).status_code == 401
    assert signed_out.get(FOLDERS).status_code == 401
