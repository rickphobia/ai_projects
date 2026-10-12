"""Turns a fetched feed body (RSS, RDF or Atom, Reddit's included) into entries."""

import io
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from html.parser import HTMLParser
from time import struct_time
from typing import Any

import feedparser

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
        title = _plain_text(raw.get("title", ""))
        url = str(raw.get("link", "")).strip()
        if not title or not url:
            continue
        entries.append(
            FeedEntry(
                title=title,
                url=url,
                excerpt=_preview(_plain_text(_summary_html(raw))),
                published_at=_date(raw.get("published_parsed") or raw.get("updated_parsed")),
                image_url=_image_url(raw),
            )
        )
    return entries


def _summary_html(raw: Any) -> str:
    summary = raw.get("summary")
    if summary:
        return str(summary)
    content = raw.get("content") or []
    return str(content[0].get("value", "")) if content else ""


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


def _preview(text: str) -> str:
    if len(text) <= _EXCERPT_LENGTH:
        return text
    return text[: _EXCERPT_LENGTH - 1].rstrip() + "…"


class _TextCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skipping = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style"):
            self._skipping += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style") and self._skipping:
            self._skipping -= 1

    def handle_data(self, data: str) -> None:
        if not self._skipping:
            self.parts.append(data)


def _plain_text(html: str) -> str:
    collector = _TextCollector()
    collector.feed(html)
    collector.close()
    return re.sub(r"\s+", " ", " ".join(collector.parts)).strip()
