"""Fetching the Sources that are due and storing their new Items."""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from rss_news.clock import Clock
from rss_news.items.inbox import ItemStore, NewItem
from rss_news.sources.catalog import Source, SourceStore
from rss_news.sources.clean_url import clean_url
from rss_news.sources.feed_parsing import FeedEntry, NotAFeed, parse_feed
from rss_news.sources.polite_queue import FetchPacing, PoliteQueue

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


@dataclass(frozen=True)
class RateLimited:
    # The site's "retry later" answer, with how long it asked us to wait if it said.
    retry_after: timedelta | None


type FetchResult = NotModified | Fetched | FetchFailed | RateLimited


class FeedFetcher(Protocol):
    def fetch(self, request: FeedRequest) -> FetchResult:
        """A conditional GET. Never raises for network or HTTP trouble: that's FetchFailed,
        or RateLimited when the site asks us to slow down."""
        ...


class SourceFetching:
    def __init__(
        self,
        *,
        sources: SourceStore,
        items: ItemStore,
        fetcher: FeedFetcher,
        clock: Clock,
        pacing: FetchPacing,
    ) -> None:
        self._sources = sources
        self._items = items
        self._fetcher = fetcher
        self._clock = clock
        self._pacing = pacing
        self._queue = PoliteQueue(pacing, clock)
        # Failures in a row per Source id, for backoff. In memory: a restart only means a
        # broken Source is tried once more at its normal interval before backing off again.
        self._failures: dict[int, int] = {}

    def fetch_due(self) -> None:
        """Fetch the due Sources politely, one request at a time. One Source failing doesn't
        stop the others; a Source whose host is on hold stays due for a later tick."""
        for source in self._queue.turns(self._sources.due(self._clock.now())):
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
            case RateLimited(retry_after=retry_after):
                self._rate_limited(source, retry_after)
            case Fetched():
                self._store(source, result)

    def _rate_limited(self, source: Source, retry_after: timedelta | None) -> None:
        if retry_after is None:
            # No delay to honour: the Source backs off like after any failure.
            self._report_failure(source, "rate limited", "no retry delay given")
            return
        self._queue.hold(source.url, retry_after)
        self._report_failure(
            source,
            "rate limited",
            f"retry after {retry_after.total_seconds():.0f}s",
            wait_at_least=retry_after,
        )

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
        self._failures.pop(source.id, None)
        now = self._clock.now()
        self._sources.record_success(
            source.id,
            at=now,
            next_fetch_at=now + self._pacing.interval_for(source.url),
            etag=etag,
            last_modified=last_modified,
        )

    def _report_failure(
        self, source: Source, step: str, detail: str, *, wait_at_least: timedelta = timedelta()
    ) -> None:
        failures, wait = self._fail(source, step, detail, wait_at_least=wait_at_least)
        logger.warning(
            "source fetch failed",
            extra={
                **_context(source),
                "step": step,
                "detail": detail,
                "failures_in_a_row": failures,
                "next_try_in_minutes": round(wait.total_seconds() / 60),
            },
        )

    def _fail(
        self, source: Source, step: str, detail: str, *, wait_at_least: timedelta = timedelta()
    ) -> tuple[int, timedelta]:
        """Record the failure and back off; returns the failures in a row and the wait."""
        failures = self._failures.get(source.id, 0) + 1
        self._failures[source.id] = failures
        wait = max(self._pacing.backoff_for(source.url, failures), wait_at_least)
        now = self._clock.now()
        self._sources.record_failure(
            source.id, at=now, next_fetch_at=now + wait, error=f"{step}: {detail}"
        )
        return failures, wait


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
