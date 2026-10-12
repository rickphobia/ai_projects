"""Notes over the API: saving, listing newest first, changing the comment, deleting, the
Markdown export, and the link back outliving its Item."""

from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.config import Settings, load_settings
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.sources.fetching import Fetched
from rss_news.wiring import Wiring
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    app_env,
    make_wiring,
)

NOTES = f"{PREFIX}/api/notes"
FEED = "https://markets.example/rss"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return load_settings(app_env(tmp_path, RSS_NEWS_ITEM_MAX_AGE_DAYS="30"))


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def fetcher() -> FakeFeedFetcher:
    return FakeFeedFetcher()


@pytest.fixture
def wiring(settings: Settings, clock: FakeClock, fetcher: FakeFeedFetcher) -> Wiring:
    starter = (StarterFolder("Markets", (StarterSource("Markets", FEED),)),)
    return make_wiring(settings, clock, feed_fetcher=fetcher, starter_folders=starter)


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


def note_body(text: str, kind: str = "chat", source_id: int = 1, comment: str = "") -> Any:
    return {
        "text": text,
        "comment": comment,
        "source": {"kind": kind, "id": source_id, "title": f"{kind} {source_id}"},
    }


def an_item(wiring: Wiring, fetcher: FakeFeedFetcher, client: TestClient) -> int:
    body = (
        '<rss version="2.0"><channel><title>t</title><item><title>BNM holds rates</title>'
        "<link>https://markets.example/1</link><description>OPR at 2.75%</description>"
        "</item></channel></rss>"
    )
    fetcher.answers[FEED] = Fetched(body.encode(), "application/rss+xml", None, None)
    wiring.tick.run()
    return int(client.get(f"{PREFIX}/api/inbox").json()["items"][0]["id"])


def test_a_saved_note_keeps_the_selection_comment_and_link_back(
    client: TestClient, wiring: Wiring, fetcher: FakeFeedFetcher
) -> None:
    item_id = an_item(wiring, fetcher, client)

    response = client.post(
        NOTES,
        json={
            "text": "  kept the OPR at 2.75%\n",
            "comment": " check next month ",
            "source": {"kind": "item", "id": item_id, "title": "Item: BNM holds rates (Markets)"},
        },
    )

    assert response.status_code == 201
    saved = response.json()
    assert saved == {
        "id": saved["id"],
        "created_at": "2026-10-12T12:00:00+00:00",
        "text": "kept the OPR at 2.75%",
        "comment": "check next month",
        "source": {
            "kind": "item",
            "id": item_id,
            "title": "Item: BNM holds rates (Markets)",
            "exists": True,
        },
    }
    assert client.get(NOTES).json() == {"notes": [saved]}


def test_notes_are_listed_newest_first(client: TestClient, clock: FakeClock) -> None:
    client.post(NOTES, json=note_body("first"))
    clock.advance(timedelta(minutes=5))
    client.post(NOTES, json=note_body("second"))

    assert [note["text"] for note in client.get(NOTES).json()["notes"]] == ["second", "first"]


def test_a_note_on_a_chat_or_briefing_says_whether_it_is_still_there(
    client: TestClient,
) -> None:
    chat_id = client.post(f"{PREFIX}/api/chats").json()["chat"]["id"]
    client.post(NOTES, json=note_body("from a chat", "chat", chat_id))
    client.post(NOTES, json=note_body("from a lost briefing", "briefing", 404))

    sources = {note["text"]: note["source"]["exists"] for note in client.get(NOTES).json()["notes"]}

    assert sources == {"from a chat": True, "from a lost briefing": False}


def test_the_link_back_outlives_an_item_deleted_by_cleanup(
    client: TestClient, wiring: Wiring, fetcher: FakeFeedFetcher, clock: FakeClock
) -> None:
    item_id = an_item(wiring, fetcher, client)
    client.post(NOTES, json=note_body("OPR at 2.75%", "item", item_id))

    clock.advance(timedelta(days=30, minutes=1))
    wiring.tick.run()
    # The sign-in from a month ago has expired.
    client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})

    assert client.get(f"{PREFIX}/api/items/{item_id}").status_code == 404
    [note] = client.get(NOTES).json()["notes"]
    assert note["text"] == "OPR at 2.75%"
    assert note["source"] == {
        "kind": "item",
        "id": item_id,
        "title": f"item {item_id}",
        "exists": False,
    }


def test_the_comment_can_be_changed_and_cleared(client: TestClient) -> None:
    note_id = client.post(NOTES, json=note_body("OPR", comment="old")).json()["id"]

    changed = client.patch(f"{NOTES}/{note_id}", json={"comment": " new "})
    assert changed.status_code == 200
    assert changed.json()["comment"] == "new"

    assert client.patch(f"{NOTES}/{note_id}", json={"comment": ""}).json()["comment"] == ""
    assert client.get(NOTES).json()["notes"][0]["comment"] == ""


def test_a_note_can_be_deleted(client: TestClient) -> None:
    note_id = client.post(NOTES, json=note_body("OPR")).json()["id"]

    assert client.delete(f"{NOTES}/{note_id}").status_code == 204
    assert client.get(NOTES).json() == {"notes": []}


def test_changing_or_deleting_a_missing_note_is_not_found(client: TestClient) -> None:
    assert client.patch(f"{NOTES}/99", json={"comment": "x"}).status_code == 404
    assert client.delete(f"{NOTES}/99").status_code == 404


def test_the_export_is_every_note_as_markdown_newest_first(
    client: TestClient, clock: FakeClock
) -> None:
    client.post(NOTES, json=note_body("BNM kept the OPR\nat 2.75%", "briefing", 404))
    clock.advance(timedelta(days=1))
    chat_id = client.post(f"{PREFIX}/api/chats").json()["chat"]["id"]
    client.post(NOTES, json=note_body("Ringgit rises", "chat", chat_id, comment="Why?"))

    response = client.get(f"{NOTES}/export")

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/markdown; charset=utf-8"
    assert response.headers["content-disposition"] == 'attachment; filename="notes.md"'
    assert response.text == (
        "# Notes\n"
        "\n> Ringgit rises\n"
        "\nWhy?\n"
        f"\n— chat {chat_id}, saved 2026-10-13\n"
        "\n> BNM kept the OPR\n> at 2.75%\n"
        "\n— briefing 404 (the briefing is gone), saved 2026-10-12\n"
    )


@pytest.mark.parametrize(
    "body",
    [
        note_body("   "),
        note_body("x" * 4001),
        note_body("OPR", comment="x" * 2001),
        note_body("OPR", kind="page"),
        {"text": "OPR"},
    ],
)
def test_a_blank_long_or_unlinked_note_is_refused(client: TestClient, body: Any) -> None:
    assert client.post(NOTES, json=body).status_code == 422
    assert client.get(NOTES).json() == {"notes": []}


def test_notes_need_a_session(wiring: Wiring) -> None:
    anonymous = TestClient(wiring.app)
    assert anonymous.get(NOTES).status_code == 401
    assert anonymous.post(NOTES, json=note_body("OPR")).status_code == 401
    assert anonymous.get(f"{NOTES}/export").status_code == 401
