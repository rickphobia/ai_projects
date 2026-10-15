"""Newsletters arriving through the fake Mailbox on each tick, seen through the API."""

import logging
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.config import load_settings
from rss_news.newsletters.collecting import MailMessage
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.wiring import Wiring
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    FakeMailbox,
    app_env,
    make_wiring,
)

FOLDERS = f"{PREFIX}/api/folders"
SOURCES = f"{PREFIX}/api/sources"
INBOX = f"{PREFIX}/api/inbox"
SECRET_BODY = "Only for subscribers: the merger closes on Friday."


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def mailbox() -> FakeMailbox:
    return FakeMailbox()


@pytest.fixture
def fetcher() -> FakeFeedFetcher:
    return FakeFeedFetcher()


@pytest.fixture
def wiring(
    tmp_path: Path, clock: FakeClock, mailbox: FakeMailbox, fetcher: FakeFeedFetcher
) -> Wiring:
    return make_wiring(
        load_settings(app_env(tmp_path)),
        clock,
        mailbox=mailbox,
        feed_fetcher=fetcher,
        starter_folders=(StarterFolder("World", (StarterSource("World", "https://w.example"),)),),
    )


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


def deliver(mailbox: FakeMailbox, clock: FakeClock, uid: str, sender: str, subject: str) -> None:
    mailbox.messages.append(
        MailMessage(
            uid=uid,
            message_id=f"{uid}@{sender}",
            sender_address=f"hello@{sender}",
            sender_name=sender.title(),
            subject=subject,
            text=SECRET_BODY,
            received_at=clock.now() - timedelta(minutes=5),
        )
    )


def sources(client: TestClient) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = client.get(SOURCES).json()["sources"]
    return result


def folders(client: TestClient) -> dict[str, int]:
    return {folder["name"]: folder["id"] for folder in client.get(FOLDERS).json()["folders"]}


def test_a_new_sender_gets_a_source_in_a_new_newsletters_folder(
    client: TestClient, wiring: Wiring, mailbox: FakeMailbox, clock: FakeClock
) -> None:
    deliver(mailbox, clock, "1", "morning.example", "Monday brief")

    wiring.tick.run()

    assert list(folders(client)) == ["World", "Newsletters"]
    (newsletter,) = [source for source in sources(client) if source["name"] != "World"]
    assert newsletter["name"] == "Morning.Example"
    assert newsletter["folder_id"] == folders(client)["Newsletters"]
    (item,) = client.get(INBOX).json()["items"]
    assert item["title"] == "Monday brief"
    assert item["source"] == "Morning.Example"
    assert item["folder"]["name"] == "Newsletters"
    assert item["url"].startswith("https://mail.google.com/")
    assert mailbox.handled == ["1"]
    assert wiring.tick.last_success() == clock.now()


def test_each_issue_is_one_item_and_a_known_sender_keeps_its_source_where_it_was_moved(
    client: TestClient, wiring: Wiring, mailbox: FakeMailbox, clock: FakeClock
) -> None:
    deliver(mailbox, clock, "1", "morning.example", "Monday brief")
    wiring.tick.run()
    (newsletter,) = [source for source in sources(client) if source["name"] != "World"]
    world = folders(client)["World"]
    assert (
        client.patch(f"{SOURCES}/{newsletter['id']}", json={"folder_id": world}).status_code == 200
    )

    deliver(mailbox, clock, "2", "morning.example", "Tuesday brief")
    wiring.tick.run()
    wiring.tick.run()

    assert len(sources(client)) == 2
    titles = {item["title"]: item["folder"]["name"] for item in client.get(INBOX).json()["items"]}
    assert titles == {"Monday brief": "World", "Tuesday brief": "World"}
    assert mailbox.handled == ["1", "2"]


def test_a_message_read_again_after_a_crash_is_not_a_second_item(
    client: TestClient, wiring: Wiring, mailbox: FakeMailbox, clock: FakeClock
) -> None:
    deliver(mailbox, clock, "1", "morning.example", "Monday brief")
    wiring.tick.run()
    mailbox.handled.clear()

    wiring.tick.run()

    assert len(client.get(INBOX).json()["items"]) == 1


def test_newsletter_sources_are_never_fetched_as_feeds(
    wiring: Wiring, mailbox: FakeMailbox, clock: FakeClock, fetcher: FakeFeedFetcher
) -> None:
    deliver(mailbox, clock, "1", "morning.example", "Monday brief")
    wiring.tick.run()
    clock.advance(timedelta(hours=1))
    fetcher.requests.clear()

    wiring.tick.run()

    assert [request.url for request in fetcher.requests] == ["https://w.example"]


def test_email_bodies_are_never_logged(
    wiring: Wiring, mailbox: FakeMailbox, clock: FakeClock, caplog: pytest.LogCaptureFixture
) -> None:
    deliver(mailbox, clock, "1", "morning.example", "Monday brief")

    with caplog.at_level(logging.DEBUG):
        wiring.tick.run()

    assert "newsletters collected" in caplog.messages
    for record in caplog.records:
        assert "merger" not in record.getMessage()
        assert all("merger" not in str(value) for value in record.__dict__.values())


def test_an_issue_reads_in_reader_view_from_the_email_itself(
    wiring: Wiring, client: TestClient, mailbox: FakeMailbox, clock: FakeClock
) -> None:
    deliver(mailbox, clock, "1", "morning.example", "Monday brief")
    wiring.tick.run()
    (issue,) = client.get(f"{PREFIX}/api/inbox").json()["items"]

    view = client.get(f"{PREFIX}/api/items/{issue['id']}/reader").json()

    assert view == {"title": None, "text": SECRET_BODY, "problem": None}
