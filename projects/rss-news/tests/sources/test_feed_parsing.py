"""Parsing saved feeds, one from each starter Source family: RSS, RDF, Atom and Reddit."""

from datetime import UTC, datetime
from html import escape
from pathlib import Path

import pytest

from rss_news.sources.feed_parsing import FeedEntry, NotAFeed, parse_feed

FEEDS = Path(__file__).parent / "feeds"


def parse_saved(name: str) -> list[FeedEntry]:
    return parse_feed((FEEDS / name).read_bytes(), content_type="application/xml")


def test_an_rss_feed_gives_one_entry_per_item() -> None:
    entries = parse_saved("bbc-world.rss.xml")

    assert len(entries) == 3
    assert entries[0] == FeedEntry(
        title="Zelensky backs Trump's 'energy ceasefire' but says Russia continues to hit "
        "power plants",
        url="https://www.bbc.co.uk/news/articles/c6pvg4jyz1m0o?at_medium=RSS&at_campaign=rss",
        excerpt="Ukraine's leader says he will support such a truce if Moscow does, after "
        "initially expressing surprise at Donald Trump's announcement.",
        published_at=datetime(2026, 10, 11, 21, 36, 40, tzinfo=UTC),
        image_url="https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/16d8/live/"
        "4817e400-c58a-11f1-bc2e-018d645d8d21.jpg",
        body="Ukraine's leader says he will support such a truce if Moscow does, after "
        "initially expressing surprise at Donald Trump's announcement.",
    )


def test_an_atom_feed_gives_entries_with_plain_text_excerpts() -> None:
    entries = parse_saved("simon-willison.atom.xml")

    assert len(entries) == 3
    first = entries[0]
    assert first.title == "Dwarf Fortress uses version control now"
    assert first.url == "https://simonwillison.net/2026/Oct/11/dwarf-fortress/"
    assert first.published_at == datetime(2026, 10, 11, 0, 52, 37, tzinfo=UTC)
    assert first.excerpt
    assert "<" not in first.excerpt


def test_a_reddit_feed_links_each_post_and_drops_the_html_table() -> None:
    entries = parse_saved("reddit-localllama.atom.xml")

    assert len(entries) == 3
    first = entries[0]
    assert first.url.startswith("https://www.reddit.com/r/LocalLLaMA/comments/1x37tg6/")
    assert first.title.startswith("Here\u2019s why RTX 5090 costs $5,000")
    assert first.published_at is not None
    assert "<" not in first.excerpt
    assert "&#32;" not in first.excerpt
    # Reddit's "submitted by /u/… [link] [comments]" line is not part of any post.
    assert all("submitted by" not in entry.excerpt for entry in entries)


def test_a_reddit_link_post_keeps_the_article_it_links_to() -> None:
    first = parse_saved("reddit-localllama.atom.xml")[0]

    assert first.linked_url == (
        "https://videocardz.com/newz/heres-why-rtx-5090-costs-5000-ai-firms-are-buying-"
        "gaming-gpus-by-the-pallet"
    )
    # No post text of its own, and none of Reddit's "submitted by" line.
    assert first.body == ""
    assert first.body_complete is False


def test_a_reddit_text_post_keeps_its_whole_text_in_paragraphs() -> None:
    second = parse_saved("reddit-localllama.atom.xml")[1]

    assert second.linked_url is None
    assert second.body_complete is True
    assert "Velvet Eclipse 2x12B" in second.body
    assert "\n" in second.body
    assert "submitted by" not in second.body
    assert "<" not in second.body
    assert len(second.body) > len(second.excerpt)


def reddit_entry(post_html: str) -> FeedEntry:
    """One Reddit text post, laid out as Reddit's feed lays it out."""
    url = "https://www.reddit.com/r/test/comments/1abc/a_post/"
    content = (
        f'<!-- SC_OFF --><div class="md">{post_html}</div><!-- SC_ON --> &#32; submitted by '
        f'&#32; <a href="https://www.reddit.com/user/someone"> /u/someone </a> <br/> '
        f'<span><a href="{url}">[link]</a></span>'
    )
    body = f"""<feed xmlns="http://www.w3.org/2005/Atom"><title>r/test</title>
      <entry><title>A post</title><link href="{url}"/><id>t3_1abc</id>
      <updated>2026-10-15T00:00:00+00:00</updated>
      <content type="html">{escape(content)}</content></entry></feed>""".encode()
    (entry,) = parse_feed(body, content_type="application/atom+xml")
    return entry


def test_a_short_reddit_text_post_sharing_a_link_reads_that_link() -> None:
    entry = reddit_entry(
        '<p>Bezos says so: <a href="https://www.forbes.com/sites/x/2026/10/08/bezos/">'
        "https://www.forbes.com/sites/x/2026/10/08/bezos/</a></p>"
    )

    assert entry.linked_url == "https://www.forbes.com/sites/x/2026/10/08/bezos/"
    assert entry.body_complete is True
    assert entry.excerpt.startswith("Bezos says so:")


def test_a_reddit_image_post_has_nothing_to_read() -> None:
    url = "https://www.reddit.com/r/test/comments/1img/a_picture/"
    content = (
        '<table><tr><td><a href="https://www.reddit.com/r/test/comments/1img/a_picture/">'
        '<img src="https://preview.redd.it/x.png" /></a></td><td> submitted by '
        '<span><a href="https://i.redd.it/abc123.png">[link]</a></span></td></tr></table>'
    )
    body = f"""<feed xmlns="http://www.w3.org/2005/Atom"><title>r/test</title>
      <entry><title>A picture</title><link href="{url}"/><id>t3_1img</id>
      <updated>2026-10-15T00:00:00+00:00</updated>
      <content type="html">{escape(content)}</content></entry></feed>""".encode()

    (entry,) = parse_feed(body, content_type="application/atom+xml")

    assert entry.linked_url is None
    assert entry.body == ""
    # Complete with no text: there is no page worth fetching.
    assert entry.body_complete is True


def test_a_long_reddit_text_post_is_read_as_itself_even_with_a_link() -> None:
    entry = reddit_entry(
        "<p>" + "A long thought. " * 40 + '</p><p>See <a href="https://example.com/a">this</a>.</p>'
    )

    assert entry.linked_url is None
    assert entry.body_complete is True


def test_a_feeds_full_content_is_kept_in_paragraphs_but_not_as_the_whole_item() -> None:
    body = b"""<rss version="2.0"><channel><title>t</title>
      <item><title>Post</title><link>https://example.com/post</link>
      <description><![CDATA[<p>First paragraph.</p><p>Second <b>bold</b> one.</p>]]></description>
      </item></channel></rss>"""

    (entry,) = parse_feed(body, content_type=None)

    assert entry.body == "First paragraph.\nSecond bold one."
    assert entry.body_complete is False
    assert entry.linked_url is None


def test_a_very_long_body_is_cut() -> None:
    long_text = "<p>" + "word " * 10_000 + "</p>"
    body = f"""<rss version="2.0"><channel><title>t</title>
      <item><title>Long</title><link>https://example.com/long</link>
      <description><![CDATA[{long_text}]]></description></item>
    </channel></rss>""".encode()

    (entry,) = parse_feed(body, content_type=None)

    assert len(entry.body) <= 20_000
    assert entry.body.endswith("…")


def test_an_rdf_feed_gives_entries() -> None:
    entries = parse_saved("nature.rdf.xml")

    assert len(entries) == 3
    assert all(entry.url.startswith("https://www.nature.com/articles/") for entry in entries)
    assert all(entry.title for entry in entries)


def test_long_excerpts_are_cut_to_a_short_preview() -> None:
    long_text = "word " * 400
    body = f"""<rss version="2.0"><channel><title>t</title>
      <item><title>Long</title><link>https://example.com/long</link>
      <description>{long_text}</description></item>
    </channel></rss>""".encode()

    (entry,) = parse_feed(body, content_type=None)

    assert len(entry.excerpt) <= 500
    assert entry.excerpt.endswith("…")


def test_entries_without_a_link_or_title_are_skipped() -> None:
    body = b"""<rss version="2.0"><channel><title>t</title>
      <item><title>No link</title></item>
      <item><link>https://example.com/untitled</link></item>
      <item><title>Kept</title><link>https://example.com/kept</link></item>
    </channel></rss>"""

    entries = parse_feed(body, content_type=None)

    assert [entry.title for entry in entries] == ["Kept"]


def test_an_entry_without_a_date_has_none() -> None:
    body = b"""<rss version="2.0"><channel><title>t</title>
      <item><title>Undated</title><link>https://example.com/undated</link></item>
    </channel></rss>"""

    (entry,) = parse_feed(body, content_type=None)

    assert entry.published_at is None


def test_an_html_page_is_not_a_feed() -> None:
    with pytest.raises(NotAFeed):
        parse_feed(b"<!doctype html><html><body>Hello</body></html>", content_type="text/html")


def test_a_body_naming_a_local_file_is_parsed_as_text_not_opened() -> None:
    with pytest.raises(NotAFeed):
        parse_feed(str(FEEDS / "bbc-world.rss.xml").encode(), content_type=None)


MEDIA_NS = 'xmlns:media="http://search.yahoo.com/mrss/"'


def parse_one_item(item_xml: str) -> FeedEntry:
    body = (
        f'<rss version="2.0" {MEDIA_NS}><channel><title>t</title><item><title>A story</title>'
        f"<link>https://news.example/a</link>{item_xml}</item></channel></rss>"
    )
    [entry] = parse_feed(body.encode(), content_type="application/rss+xml")
    return entry


def test_a_reddit_post_keeps_its_media_thumbnail() -> None:
    first = parse_saved("reddit-localllama.atom.xml")[0]

    assert first.image_url is not None
    assert first.image_url.startswith("https://")


@pytest.mark.parametrize(
    "item_xml",
    [
        '<media:thumbnail url="https://img.example/a.jpg"/>',
        '<media:content url="https://img.example/a.jpg" medium="image"/>',
        '<media:content url="https://img.example/a.jpg" type="image/jpeg"/>',
        '<enclosure url="https://img.example/a.jpg" type="image/jpeg" length="1"/>',
    ],
    ids=["media thumbnail", "media content by medium", "media content by type", "enclosure"],
)
def test_each_image_form_gives_the_image_link(item_xml: str) -> None:
    assert parse_one_item(item_xml).image_url == "https://img.example/a.jpg"


def test_the_media_thumbnail_wins_over_other_images() -> None:
    entry = parse_one_item(
        '<enclosure url="https://img.example/big.jpg" type="image/jpeg" length="1"/>'
        '<media:thumbnail url="https://img.example/small.jpg"/>'
    )

    assert entry.image_url == "https://img.example/small.jpg"


def test_an_item_without_an_image_has_none() -> None:
    assert parse_one_item("<description>No picture here</description>").image_url is None


@pytest.mark.parametrize(
    "item_xml",
    [
        '<enclosure url="https://pod.example/a.mp3" type="audio/mpeg" length="1"/>',
        '<media:content url="https://vid.example/a.mp4" medium="video"/>',
        '<media:thumbnail url="javascript:alert(1)"/>',
        '<media:thumbnail url="data:image/png;base64,AAAA"/>',
    ],
    ids=["audio enclosure", "video content", "javascript link", "data link"],
)
def test_links_that_are_not_web_images_are_dropped(item_xml: str) -> None:
    assert parse_one_item(item_xml).image_url is None
