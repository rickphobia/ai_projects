"""Opening one Item: it shows, becomes read, and its Reader view is extracted on demand."""

from dataclasses import replace
from html import escape
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rss_news.config import load_settings
from rss_news.items.reading import ReaderView
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.sources.fetching import Fetched
from rss_news.wiring import Wiring
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeArticleExtractor,
    FakeClock,
    FakeFeedFetcher,
    app_env,
    make_wiring,
)
from tests.web.test_inbox import rss

FEED = "https://world.example/rss"
STORY = "https://world.example/story"
STARTER = (StarterFolder("World", (StarterSource("World News", FEED),)),)


@pytest.fixture
def extractor() -> FakeArticleExtractor:
    return FakeArticleExtractor()


@pytest.fixture
def wiring(tmp_path: Path, extractor: FakeArticleExtractor) -> Wiring:
    fetcher = FakeFeedFetcher()
    fetcher.answers[FEED] = with_preview(rss(("A story", STORY, None)), "What the feed says.")
    wiring = make_wiring(
        load_settings(app_env(tmp_path)),
        FakeClock(),
        feed_fetcher=fetcher,
        article_extractor=extractor,
        starter_folders=STARTER,
    )
    wiring.tick.run()
    return wiring


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


def with_preview(feed: Fetched, preview: str) -> Fetched:
    """The feed with the preview text a feed gives each item, as RSS's description."""
    body = feed.body.decode().replace("</item>", f"<description>{preview}</description></item>")
    return replace(feed, body=body.encode())


def only_item(client: TestClient) -> dict[str, object]:
    items: list[dict[str, object]] = client.get(f"{PREFIX}/api/inbox").json()["items"]
    assert len(items) == 1
    return items[0]


def test_new_items_are_unread(client: TestClient) -> None:
    assert only_item(client)["read"] is False


def test_showing_an_item_gives_its_details_and_marks_it_read(client: TestClient) -> None:
    item_id = only_item(client)["id"]

    response = client.get(f"{PREFIX}/api/items/{item_id}")

    assert response.status_code == 200
    shown = response.json()
    assert shown["title"] == "A story"
    assert shown["url"] == STORY
    assert shown["source"] == "World News"
    assert shown["summary"] == "Summary of A story"
    assert shown["importance"] == 3
    assert only_item(client)["read"] is True


def test_read_state_survives_a_restart(tmp_path: Path, client: TestClient) -> None:
    client.get(f"{PREFIX}/api/items/{only_item(client)['id']}")

    restarted = TestClient(make_wiring(load_settings(app_env(tmp_path)), FakeClock()).app)
    restarted.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})

    assert only_item(restarted)["read"] is True


def test_an_unknown_item_is_404(client: TestClient) -> None:
    assert client.get(f"{PREFIX}/api/items/999").status_code == 404
    assert client.get(f"{PREFIX}/api/items/999/reader").status_code == 404


def test_reader_view_extracts_the_original_page_each_time(
    client: TestClient, extractor: FakeArticleExtractor
) -> None:
    extractor.pages[STORY] = ReaderView(title="A story", text="First paragraph.\nSecond.")
    item_id = only_item(client)["id"]

    first = client.get(f"{PREFIX}/api/items/{item_id}/reader")
    client.get(f"{PREFIX}/api/items/{item_id}/reader")

    assert first.status_code == 200
    assert first.json() == {
        "title": "A story",
        "text": "First paragraph.\nSecond.",
        "problem": None,
    }
    # Nothing is kept: every open fetches the page again.
    assert extractor.requested == [STORY, STORY]


def test_an_unreadable_page_falls_back_to_the_feeds_preview(client: TestClient) -> None:
    # Such as Reddit, which refuses servers. Not a 5xx: Cloudflare replaces those with its own
    # page, and the owner would never see why.
    response = client.get(f"{PREFIX}/api/items/{only_item(client)['id']}/reader")

    assert response.status_code == 200
    assert response.json() == {
        "title": None,
        "text": "What the feed says.",
        "problem": "no article text was found on the page",
    }


def test_an_unreadable_page_without_a_preview_says_so(tmp_path: Path) -> None:
    fetcher = FakeFeedFetcher()
    fetcher.answers[FEED] = rss(("A story", STORY, None))
    wiring = make_wiring(
        load_settings(app_env(tmp_path)),
        FakeClock(),
        feed_fetcher=fetcher,
        article_extractor=FakeArticleExtractor(),
        starter_folders=STARTER,
    )
    wiring.tick.run()
    client = TestClient(wiring.app)
    client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})

    response = client.get(f"{PREFIX}/api/items/{only_item(client)['id']}/reader")

    assert response.status_code == 200
    assert response.json()["text"] == ""
    assert response.json()["problem"] == "no article text was found on the page"


def test_reader_view_needs_a_session(wiring: Wiring) -> None:
    assert TestClient(wiring.app).get(f"{PREFIX}/api/items/1/reader").status_code == 401


REDDIT_FEED = "https://www.reddit.com/r/LocalLLaMA/.rss"
VIDEOCARDZ = (
    "https://videocardz.com/newz/heres-why-rtx-5090-costs-5000-ai-firms-are-buying-gaming-"
    "gpus-by-the-pallet"
)


@pytest.fixture
def reddit(tmp_path: Path, extractor: FakeArticleExtractor) -> TestClient:
    """Signed in, with the saved r/LocalLLaMA feed fetched: a link post and two text posts."""
    fetcher = FakeFeedFetcher()
    saved = Path(__file__).parents[1] / "sources" / "feeds" / "reddit-localllama.atom.xml"
    fetcher.answers[REDDIT_FEED] = Fetched(saved.read_bytes(), "application/atom+xml", None, None)
    wiring = make_wiring(
        load_settings(app_env(tmp_path)),
        FakeClock(),
        feed_fetcher=fetcher,
        article_extractor=extractor,
        starter_folders=(StarterFolder("AI", (StarterSource("r/LocalLLaMA", REDDIT_FEED),)),),
    )
    wiring.tick.run()
    client = TestClient(wiring.app)
    client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})
    return client


def reader_of(client: TestClient, title_start: str) -> dict[str, object]:
    items = client.get(f"{PREFIX}/api/inbox").json()["items"]
    item_id = next(item["id"] for item in items if item["title"].startswith(title_start))
    view: dict[str, object] = client.get(f"{PREFIX}/api/items/{item_id}/reader").json()
    return view


def test_a_reddit_text_post_reads_from_the_feed_without_fetching_reddit(
    reddit: TestClient, extractor: FakeArticleExtractor
) -> None:
    view = reader_of(reddit, "Every Model That Can Be Run")

    assert view["problem"] is None
    assert "Velvet Eclipse 2x12B" in str(view["text"])
    assert extractor.requested == []


def test_a_reddit_link_post_reads_the_article_it_links_to(
    reddit: TestClient, extractor: FakeArticleExtractor
) -> None:
    extractor.pages[VIDEOCARDZ] = ReaderView(title="RTX 5090", text="Pallets of GPUs.")

    view = reader_of(reddit, "Here\u2019s why RTX 5090")

    assert view == {"title": "RTX 5090", "text": "Pallets of GPUs.", "problem": None}
    assert extractor.requested == [VIDEOCARDZ]


def test_a_reddit_link_post_whose_article_cant_be_read_says_why(
    reddit: TestClient, extractor: FakeArticleExtractor
) -> None:
    view = reader_of(reddit, "Here\u2019s why RTX 5090")

    assert view["problem"] == "no article text was found on the page"
    assert extractor.requested[0] == VIDEOCARDZ


def test_a_reddit_post_whose_linked_article_cant_be_read_shows_the_post(
    tmp_path: Path, extractor: FakeArticleExtractor
) -> None:
    post = "https://www.reddit.com/r/test/comments/1abc/a_post/"
    article = "https://news.example/bezos"
    content = (
        f'<!-- SC_OFF --><div class="md"><p>Bezos says so: <a href="{article}">{article}</a>'
        f'</p></div><!-- SC_ON --> submitted by <span><a href="{post}">[link]</a></span>'
    )
    feed = f"""<feed xmlns="http://www.w3.org/2005/Atom"><title>r/test</title>
      <entry><title>A post</title><link href="{post}"/><id>t3_1abc</id>
      <updated>2026-10-15T00:00:00+00:00</updated>
      <content type="html">{escape(content)}</content></entry></feed>"""
    fetcher = FakeFeedFetcher()
    fetcher.answers[REDDIT_FEED] = Fetched(feed.encode(), "application/atom+xml", None, None)
    wiring = make_wiring(
        load_settings(app_env(tmp_path)),
        FakeClock(),
        feed_fetcher=fetcher,
        article_extractor=extractor,
        starter_folders=(StarterFolder("AI", (StarterSource("r/test", REDDIT_FEED),)),),
    )
    wiring.tick.run()
    client = TestClient(wiring.app)
    client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})

    view = reader_of(client, "A post")

    assert view["text"] == f"Bezos says so: {article}"
    assert view["problem"] == "no article text was found on the page"
    # Reddit's own page is never asked for: the post is all there is.
    assert extractor.requested == [article]


def test_an_item_with_nothing_but_a_picture_says_so_without_fetching(
    tmp_path: Path, extractor: FakeArticleExtractor
) -> None:
    post = "https://www.reddit.com/r/test/comments/1img/a_picture/"
    content = f'submitted by <span><a href="https://i.redd.it/abc.png">[link]</a></span> {post}'
    feed = f"""<feed xmlns="http://www.w3.org/2005/Atom"><title>r/test</title>
      <entry><title>A picture</title><link href="{post}"/><id>t3_1img</id>
      <updated>2026-10-15T00:00:00+00:00</updated>
      <content type="html">{escape(content)}</content></entry></feed>"""
    fetcher = FakeFeedFetcher()
    fetcher.answers[REDDIT_FEED] = Fetched(feed.encode(), "application/atom+xml", None, None)
    wiring = make_wiring(
        load_settings(app_env(tmp_path)),
        FakeClock(),
        feed_fetcher=fetcher,
        article_extractor=extractor,
        starter_folders=(StarterFolder("AI", (StarterSource("r/test", REDDIT_FEED),)),),
    )
    wiring.tick.run()
    client = TestClient(wiring.app)
    client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD})

    view = reader_of(client, "A picture")

    assert view == {
        "title": None,
        "text": "",
        "problem": "it is a picture or video with no text",
    }
    assert extractor.requested == []
