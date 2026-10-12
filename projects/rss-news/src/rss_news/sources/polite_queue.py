"""The polite fetch queue: how often each Source is asked, and whose turn it is, host by host."""

import logging
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from urllib.parse import urlsplit

from rss_news.clock import Clock
from rss_news.sources.catalog import Source

logger = logging.getLogger(__name__)

_REDDIT_DOMAIN = "reddit.com"
# Enough doublings to reach any sensible maximum; more would overflow timedelta.
_MAX_DOUBLINGS = 20


@dataclass(frozen=True)
class FetchPacing:
    """The settings for how often Sources are asked and how far apart."""

    interval: timedelta
    reddit_gap: timedelta
    reddit_interval: timedelta
    # Backoff after failures stops growing here; the Source keeps being tried at this pace.
    max_backoff: timedelta

    def interval_for(self, url: str) -> timedelta:
        """How long after a successful fetch the Source is due again."""
        return self.reddit_interval if _is_reddit(host_of(url)) else self.interval

    def backoff_for(self, url: str, failures: int) -> timedelta:
        """How long after its `failures`-th failure in a row the Source is due again.

        The interval doubles with each failure up to the maximum. A Source is never given up
        on, so the owner can see it is still broken and a fixed feed comes back by itself.
        """
        interval = self.interval_for(url)
        doublings = min(max(failures - 1, 0), _MAX_DOUBLINGS)
        doubled = interval * (1 << doublings)
        return max(interval, min(doubled, self.max_backoff))

    def gap_for(self, host: str) -> timedelta:
        """How long to leave after a request to `host` before the next one."""
        return self.reddit_gap if _is_reddit(host) else timedelta()


class PoliteQueue:
    """Hands out due Sources one at a time, never asking a host before its turn.

    A host's turn comes after its gap since the last request ended (a short wait the queue
    sleeps through, asking other hosts meanwhile) and after any retry delay it gave (often
    long: its Sources are left for a later tick). Both are kept in memory; after a restart a
    held host may be asked once more and will give its retry delay again.
    """

    def __init__(self, pacing: FetchPacing, clock: Clock) -> None:
        self._pacing = pacing
        self._clock = clock
        self._spaced_until: dict[str, datetime] = {}
        self._held_until: dict[str, datetime] = {}

    def turns(self, due: Sequence[Source]) -> Iterator[Source]:
        """Yield the Sources whose host may be asked now, in order where possible.

        Fetch each yielded Source before asking for the next: the host's gap starts from when
        the caller comes back for another.
        """
        pending = list(due)
        while pending:
            now = self._clock.now()
            pending = [source for source in pending if not self._is_held(source, now)]
            ready = next((source for source in pending if self._is_free(source, now)), None)
            if ready is None:
                if pending:
                    self._clock.sleep(min(self._spaced_until[_host(s)] for s in pending) - now)
                continue
            pending.remove(ready)
            yield ready
            self._space_out(_host(ready))

    def hold(self, url: str, retry_after: timedelta) -> None:
        """Ask nothing more of `url`'s host until `retry_after` has passed."""
        host = host_of(url)
        until = self._clock.now() + retry_after
        self._held_until[host] = max(until, self._held_until.get(host, until))
        logger.info(
            "host on hold", extra={"host": host, "retry_after_seconds": retry_after.total_seconds()}
        )

    def _is_held(self, source: Source, now: datetime) -> bool:
        held_until = self._held_until.get(_host(source))
        if held_until is None or held_until <= now:
            return False
        logger.debug(
            "source left for a later tick: host on hold",
            extra={"source_id": source.id, "source": source.name, "host": _host(source)},
        )
        return True

    def _is_free(self, source: Source, now: datetime) -> bool:
        return self._spaced_until.get(_host(source), now) <= now

    def _space_out(self, host: str) -> None:
        gap = self._pacing.gap_for(host)
        if gap:
            self._spaced_until[host] = self._clock.now() + gap


def host_of(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def _host(source: Source) -> str:
    return host_of(source.url)


def _is_reddit(host: str) -> bool:
    return host == _REDDIT_DOMAIN or host.endswith("." + _REDDIT_DOMAIN)
