"""Turns a fetched feed body (RSS, RDF or Atom, Reddit's included) into entries."""

import io
from dataclasses import dataclass
from datetime import UTC, datetime
from time import struct_time
from typing import Any

import feedparser

from rss_news.items.inbox import BODY_LENGTH
from rss_news.sources.feed_text import cut, paragraphs, plain_text
from rss_news.sources.reddit_posts import is_reddit_post, reddit_post

_EXCERPT_LENGTH = 500


class NotAFeed(Exception):
    """The body isn't an RSS, RDF or Atom feed."""


@dataclass(frozen=True)
class FeedEntry:
    title: str
    # The link as the feed gives it; cleaning it is up to the caller.
    url: str
    # Plain text, at most a short preview long.
    excerpt: str
    # None when the feed gives no date.
    published_at: datetime | None
    # An http(s) image link the feed gives for the entry; None when it gives none.
    image_url: str | None = None
    # The entry's text in paragraphs, at most BODY_LENGTH long; empty when the feed gives none.
    body: str = ""
    # True when `body` is the whole thing, as for a Reddit text post, so Reader view needn't
    # fetch the page.
    body_complete: bool = False
    # The article a Reddit link post points to, which Reader view reads instead of Reddit.
    linked_url: str | None = None


def parse_feed(body: bytes, *, content_type: str | None) -> list[FeedEntry]:
    """The entries in `body`, in feed order. Entries without a title or link are skipped.

    Raises NotAFeed when the body isn't a feed, such as an HTML page or an error message.
    """
    # Wrapped in a stream on purpose: given bytes, feedparser first tries them as a file
    # name, so a body naming a local file would read that file.
    parsed: Any = feedparser.parse(
        io.BytesIO(body),
        response_headers={"content-type": content_type} if content_type else None,
        # Excerpts are reduced to plain text below; no HTML from a feed is ever shown.
        sanitize_html=False,
        resolve_relative_uris=False,
    )
    if not parsed.get("version"):
        reason = parsed.get("bozo_exception") or "no RSS, RDF or Atom root element"
        raise NotAFeed(f"not a feed: {reason}")
    entries = []
    for raw in parsed.entries:
        title = plain_text(raw.get("title", ""))
        url = str(raw.get("link", "")).strip()
        if not title or not url:
            continue
        summary = _summary_html(raw)
        if is_reddit_post(url):
            post = reddit_post(summary)
            text, linked_url = post.text, post.linked_url
            # A picture or video post is complete too: there is no text anywhere to read.
            body_complete = bool(post.text) or post.is_media
            # Only the post itself, without Reddit's "submitted by" line.
            excerpt = " ".join(text.split("\n"))
        else:
            text, body_complete, linked_url = paragraphs(_content_html(raw)), False, None
            excerpt = plain_text(summary)
        entries.append(
            FeedEntry(
                title=title,
                url=url,
                excerpt=cut(excerpt, _EXCERPT_LENGTH),
                published_at=_date(raw.get("published_parsed") or raw.get("updated_parsed")),
                image_url=_image_url(raw),
                body=cut(text, BODY_LENGTH),
                body_complete=body_complete,
                linked_url=linked_url,
            )
        )
    return entries


def _summary_html(raw: Any) -> str:
    summary = raw.get("summary")
    if summary:
        return str(summary)
    content = raw.get("content") or []
    return str(content[0].get("value", "")) if content else ""


def _content_html(raw: Any) -> str:
    """The fullest text the entry has: its content, which feeds use for whole posts, before
    its summary."""
    content = raw.get("content") or []
    full = str(content[0].get("value", "")) if content else ""
    return full or str(raw.get("summary") or "")


def _image_url(raw: Any) -> str | None:
    """The first image the feed itself names: a media thumbnail, then an image in media
    content, then an image enclosure. Images inside the summary HTML are not looked at."""
    candidates = [thumbnail.get("url") for thumbnail in raw.get("media_thumbnail") or []]
    candidates += [
        media.get("url")
        for media in raw.get("media_content") or []
        if media.get("medium") == "image" or str(media.get("type", "")).startswith("image/")
    ]
    candidates += [
        enclosure.get("href")
        for enclosure in raw.get("enclosures") or []
        if str(enclosure.get("type", "")).startswith("image/")
    ]
    for candidate in candidates:
        link = str(candidate or "").strip()
        # Only web links: a javascript: or data: link must never reach an <img>.
        if link.lower().startswith(("http://", "https://")):
            return link
    return None


def _date(parsed: struct_time | None) -> datetime | None:
    # feedparser gives every date as a UTC struct_time.
    if parsed is None:
        return None
    return datetime(*parsed[:6], tzinfo=UTC)
