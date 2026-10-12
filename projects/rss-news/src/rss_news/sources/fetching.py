"""Fetching the Sources that are due and storing their new Items."""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from rss_news.clock import Clock
from rss_news.items.inbox import ItemStore, NewItem
from rss_news.sources.catalog import FetchSchedule, Source
from rss_news.sources.clean_url import clean_url
from rss_news.sources.feed_parsing import FeedEntry, NotAFeed, parse_feed

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FeedRequest:
    url: str
    # Sent as If-None-Match and If-Modified-Since when known.
    etag: str | None
    last_modified: str | None


@dataclass(frozen=True)
class NotModified:
    pass


@dataclass(frozen=True)
class Fetched:
    body: bytes
    content_type: str | None
    etag: str | None
    last_modified: str | None


@dataclass(frozen=True)
class FetchFailed:
    # Which part failed, such as "connect" or "http status", and what happened.
    step: str
    detail: str


type FetchResult = NotModified | Fetched | FetchFailed


class FeedFetcher(Protocol):
    def fetch(self, request: FeedRequest) -> FetchResult:
        """A conditional GET. Never raises for network or HTTP trouble: that's FetchFailed."""
        ...


class SourceFetching:
    def __init__(
        self,
        *,
        sources: FetchSchedule,
        items: ItemStore,
        fetcher: FeedFetcher,
        clock: Clock,
        interval: timedelta,
    ) -> None:
        self._sources = sources
        self._items = items
        self._fetcher = fetcher
        self._clock = clock
        self._interval = interval

    def fetch_due(self) -> None:
        """Fetch every due Source. One Source failing doesn't stop the others."""
        for source in self._sources.due(self._clock.now()):
            try:
                self._fetch(source)
            except Exception as error:
                # A bug or a database error for one Source: log it, keep going with the rest,
                # and try this one again next interval instead of every minute.
                logger.exception("source fetch crashed", extra=_context(source))
                try:
                    self._fail(source, "unexpected", str(error))
                except Exception:
                    logger.exception("source failure not recorded", extra=_context(source))

    def _fetch(self, source: Source) -> None:
        result = self._fetcher.fetch(FeedRequest(source.url, source.etag, source.last_modified))
        match result:
            case NotModified():
                self._succeed(source, etag=source.etag, last_modified=source.last_modified)
                logger.debug("source not modified", extra=_context(source))
            case FetchFailed(step=step, detail=detail):
                self._report_failure(source, step, detail)
            case Fetched():
                self._store(source, result)

    def _store(self, source: Source, fetched: Fetched) -> None:
        try:
            entries = parse_feed(fetched.body, content_type=fetched.content_type)
        except NotAFeed as error:
            self._report_failure(source, "parse", str(error))
            return
        now = self._clock.now()
        new_items = [_new_item(source, entry, now) for entry in entries]
        stored = self._items.add_new(new_items)
        self._succeed(source, etag=fetched.etag, last_modified=fetched.last_modified)
        logger.info(
            "source fetched",
            extra={**_context(source), "entries": len(entries), "new_items": stored},
        )

    def _succeed(self, source: Source, *, etag: str | None, last_modified: str | None) -> None:
        now = self._clock.now()
        self._sources.record_success(
            source.id,
            at=now,
            next_fetch_at=now + self._interval,
            etag=etag,
            last_modified=last_modified,
        )

    def _report_failure(self, source: Source, step: str, detail: str) -> None:
        logger.warning(
            "source fetch failed", extra={**_context(source), "step": step, "detail": detail}
        )
        self._fail(source, step, detail)

    def _fail(self, source: Source, step: str, detail: str) -> None:
        now = self._clock.now()
        self._sources.record_failure(
            source.id, at=now, next_fetch_at=now + self._interval, error=f"{step}: {detail}"
        )


def _new_item(source: Source, entry: FeedEntry, now: datetime) -> NewItem:
    # An undated or future-dated entry counts as arriving now, so it can't sit on top of the
    # Inbox for days.
    published = entry.published_at if entry.published_at and entry.published_at < now else now
    return NewItem(
        source_id=source.id,
        title=entry.title,
        url=entry.url,
        clean_url=clean_url(entry.url),
        excerpt=entry.excerpt,
        published_at=published,
    )


def _context(source: Source) -> dict[str, object]:
    return {"source_id": source.id, "source": source.name}
