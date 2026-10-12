"""Managing Folders and Sources over the API, with the fake FeedFetcher for the URL check."""

from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.config import Settings, load_settings
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.sources.fetching import Fetched, FetchFailed
from rss_news.wiring import Wiring
from tests.support import OWNER_PASSWORD, PREFIX, FakeClock, FakeFeedFetcher, app_env, make_wiring

FOLDERS = f"{PREFIX}/api/folders"
SOURCES = f"{PREFIX}/api/sources"
INBOX = f"{PREFIX}/api/inbox"

WORLD_FEED = "https://world.example/rss"
NEW_FEED = "https://new.example/feed.xml"
STARTER = (StarterFolder("World", (StarterSource("World News", WORLD_FEED),)),)


def rss(title: str, link: str) -> Fetched:
    body = (
        f'<rss version="2.0"><channel><title>t</title>'
        f"<item><title>{title}</title><link>{link}</link></item></channel></rss>"
    )
    return Fetched(body.encode(), "application/rss+xml", etag=None, last_modified=None)


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


def folder_names(client: TestClient) -> list[str]:
    return [folder["name"] for folder in client.get(FOLDERS).json()["folders"]]


def world_id(client: TestClient) -> int:
    return int(client.get(FOLDERS).json()["folders"][0]["id"])


def sources(client: TestClient) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = client.get(SOURCES).json()["sources"]
    return result


def source_named(client: TestClient, name: str) -> dict[str, Any]:
    return next(source for source in sources(client) if source["name"] == name)


def test_a_folder_is_created_renamed_and_deleted(client: TestClient) -> None:
    created = client.post(FOLDERS, json={"name": "  Macro "})
    assert created.status_code == 201
    macro = created.json()["id"]

    assert client.patch(f"{FOLDERS}/{macro}", json={"name": "Markets"}).status_code == 204
    assert folder_names(client) == ["World", "Markets"]

    assert client.delete(f"{FOLDERS}/{macro}").status_code == 204
    assert folder_names(client) == ["World"]


def test_a_second_folder_with_the_same_name_is_refused(client: TestClient) -> None:
    response = client.post(FOLDERS, json={"name": "World"})

    assert response.status_code == 409
    assert "already a Folder named 'World'" in response.json()["detail"]


def test_a_blank_folder_name_is_refused(client: TestClient) -> None:
    assert client.post(FOLDERS, json={"name": "   "}).status_code == 422


def test_deleting_a_folder_that_still_has_sources_is_refused(client: TestClient) -> None:
    response = client.delete(f"{FOLDERS}/{world_id(client)}")

    assert response.status_code == 409
    assert "still has 1 Source(s)" in response.json()["detail"]
    assert folder_names(client) == ["World"]


def test_changing_a_folder_that_does_not_exist_is_refused(client: TestClient) -> None:
    assert client.patch(f"{FOLDERS}/999", json={"name": "X"}).status_code == 404
    assert client.delete(f"{FOLDERS}/999").status_code == 404


def test_sources_are_listed_with_their_last_success_and_last_error(
    client: TestClient, wiring: Wiring, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss("Story", "https://world.example/a")
    wiring.tick.run()
    succeeded_at = clock.now()
    clock.advance(timedelta(minutes=15))
    fetcher.answers[WORLD_FEED] = FetchFailed("http status", "answered 503")
    wiring.tick.run()

    (world,) = sources(client)

    assert world["name"] == "World News"
    assert world["url"] == WORLD_FEED
    assert world["folder_id"] == world_id(client)
    assert world["paused"] is False
    assert world["last_success_at"] == succeeded_at.isoformat()
    assert world["last_error_at"] == clock.now().isoformat()
    assert world["last_error"] == "http status: answered 503"


def test_a_feed_url_is_checked_once_and_added(
    client: TestClient, wiring: Wiring, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[NEW_FEED] = rss("New story", "https://new.example/a")

    response = client.post(SOURCES, json={"folder_id": world_id(client), "url": NEW_FEED})

    assert response.status_code == 201
    assert response.json()["name"] == "new.example"
    assert [request.url for request in fetcher.requests] == [NEW_FEED]
    wiring.tick.run()
    assert "New story" in [item["title"] for item in client.get(INBOX).json()["items"]]


def test_a_feed_url_keeps_the_name_the_owner_gave(
    client: TestClient, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[NEW_FEED] = rss("New story", "https://new.example/a")

    client.post(SOURCES, json={"folder_id": world_id(client), "url": NEW_FEED, "name": "New"})

    assert source_named(client, "New")["url"] == NEW_FEED


def test_a_url_that_is_not_a_feed_is_refused(client: TestClient, fetcher: FakeFeedFetcher) -> None:
    fetcher.answers[NEW_FEED] = Fetched(b"<html>a page</html>", "text/html", None, None)

    response = client.post(SOURCES, json={"folder_id": world_id(client), "url": NEW_FEED})

    assert response.status_code == 422
    assert f"{NEW_FEED} isn't an RSS or Atom feed" in response.json()["detail"]
    assert len(sources(client)) == 1


def test_a_url_that_cannot_be_fetched_is_refused(client: TestClient) -> None:
    response = client.post(SOURCES, json={"folder_id": world_id(client), "url": NEW_FEED})

    assert response.status_code == 422
    assert f"couldn't fetch {NEW_FEED} (connect:" in response.json()["detail"]


def test_a_url_that_is_not_http_is_refused_without_fetching(
    client: TestClient, fetcher: FakeFeedFetcher
) -> None:
    response = client.post(SOURCES, json={"folder_id": world_id(client), "url": "file:///etc/x"})

    assert response.status_code == 422
    assert fetcher.requests == []


def test_a_feed_already_followed_is_refused(client: TestClient, fetcher: FakeFeedFetcher) -> None:
    fetcher.answers[WORLD_FEED] = rss("Story", "https://world.example/a")

    response = client.post(SOURCES, json={"folder_id": world_id(client), "url": WORLD_FEED})

    assert response.status_code == 409


def test_a_source_in_a_folder_that_does_not_exist_is_refused(
    client: TestClient, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[NEW_FEED] = rss("New story", "https://new.example/a")

    assert client.post(SOURCES, json={"folder_id": 999, "url": NEW_FEED}).status_code == 404


@pytest.mark.parametrize("typed", ["LocalLLaMA", "r/LocalLLaMA", "/r/LocalLLaMA "])
def test_a_subreddit_by_name_gets_its_feed_url(
    client: TestClient, fetcher: FakeFeedFetcher, typed: str
) -> None:
    response = client.post(SOURCES, json={"folder_id": world_id(client), "subreddit": typed})

    assert response.status_code == 201
    assert response.json()["name"] == "r/LocalLLaMA"
    assert response.json()["url"] == "https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day"
    assert fetcher.requests == []


def test_a_subreddit_name_with_other_characters_is_refused(client: TestClient) -> None:
    response = client.post(SOURCES, json={"folder_id": world_id(client), "subreddit": "a b/c"})

    assert response.status_code == 422
    assert "isn't a subreddit name" in response.json()["detail"]


def test_a_new_source_needs_exactly_one_of_url_and_subreddit(client: TestClient) -> None:
    folder = world_id(client)

    assert client.post(SOURCES, json={"folder_id": folder}).status_code == 422
    both = {"folder_id": folder, "url": NEW_FEED, "subreddit": "x1"}
    assert client.post(SOURCES, json=both).status_code == 422


def test_a_source_moves_to_another_folder(
    client: TestClient, wiring: Wiring, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss("Story", "https://world.example/a")
    wiring.tick.run()
    macro = client.post(FOLDERS, json={"name": "Macro"}).json()["id"]
    world = source_named(client, "World News")

    response = client.patch(f"{SOURCES}/{world['id']}", json={"folder_id": macro})

    assert response.status_code == 200
    assert response.json()["folder_id"] == macro
    (item,) = client.get(INBOX).json()["items"]
    assert item["folder"]["name"] == "Macro"


def test_moving_a_source_to_a_folder_that_does_not_exist_is_refused(client: TestClient) -> None:
    world = source_named(client, "World News")

    assert client.patch(f"{SOURCES}/{world['id']}", json={"folder_id": 999}).status_code == 404


def test_a_paused_source_is_not_fetched_until_resumed(
    client: TestClient, wiring: Wiring, fetcher: FakeFeedFetcher
) -> None:
    world = source_named(client, "World News")

    paused = client.patch(f"{SOURCES}/{world['id']}", json={"paused": True})
    wiring.tick.run()

    assert paused.json()["paused"] is True
    assert fetcher.requests == []
    client.patch(f"{SOURCES}/{world['id']}", json={"paused": False})
    wiring.tick.run()
    assert [request.url for request in fetcher.requests] == [WORLD_FEED]


def test_a_removed_source_takes_its_items_out_of_the_inbox(
    client: TestClient, wiring: Wiring, fetcher: FakeFeedFetcher
) -> None:
    fetcher.answers[WORLD_FEED] = rss("Story", "https://world.example/a")
    wiring.tick.run()
    world = source_named(client, "World News")

    assert client.delete(f"{SOURCES}/{world['id']}").status_code == 204

    assert sources(client) == []
    assert client.get(INBOX).json()["items"] == []
    assert client.delete(f"{FOLDERS}/{world['folder_id']}").status_code == 204


def test_changing_a_source_that_does_not_exist_is_refused(client: TestClient) -> None:
    assert client.patch(f"{SOURCES}/999", json={"paused": True}).status_code == 404
    assert client.delete(f"{SOURCES}/999").status_code == 404


def test_managing_sources_needs_a_session(wiring: Wiring) -> None:
    signed_out = TestClient(wiring.app)

    assert signed_out.get(SOURCES).status_code == 401
    assert signed_out.post(FOLDERS, json={"name": "X"}).status_code == 401
    assert signed_out.delete(f"{SOURCES}/1").status_code == 401
