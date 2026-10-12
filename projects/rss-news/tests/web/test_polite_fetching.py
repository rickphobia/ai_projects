"""Polite fetching: Reddit spacing and interval, retry delays and backoff, through the tick."""

from datetime import datetime, timedelta
from pathlib import Path

import pytest

from rss_news.config import Settings, load_settings
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.sources.fetching import NotModified, RateLimited
from rss_news.wiring import Wiring
from tests.support import FakeClock, FakeFeedFetcher, app_env, make_wiring

SUBREDDIT_A = "https://www.reddit.com/r/a/.rss"
SUBREDDIT_B = "https://www.reddit.com/r/b/.rss"
NEWS_FEED = "https://news.example/rss"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return load_settings(
        app_env(
            tmp_path,
            RSS_NEWS_FETCH_INTERVAL_MINUTES="15",
            RSS_NEWS_REDDIT_GAP_SECONDS="10",
            RSS_NEWS_REDDIT_INTERVAL_MINUTES="60",
            RSS_NEWS_FETCH_MAX_BACKOFF_HOURS="1",
        )
    )


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


def app_with(settings: Settings, fetcher: FakeFeedFetcher, clock: FakeClock, *urls: str) -> Wiring:
    sources = tuple(StarterSource(f"Source {n}", url) for n, url in enumerate(urls))
    return make_wiring(
        settings, clock, feed_fetcher=fetcher, starter_folders=(StarterFolder("All", sources),)
    )


def tick_every_minute(wiring: Wiring, clock: FakeClock, *, until: datetime) -> None:
    """Run the tick now and then once a minute, as `rss-news serve` does, up to `until`."""
    while clock.now() <= until:
        wiring.tick.run()
        clock.advance(timedelta(minutes=1))


def minutes_asked(fetcher: FakeFeedFetcher, url: str, start: datetime) -> list[float]:
    return [(at - start) / timedelta(minutes=1) for asked, at in fetcher.asked_at if asked == url]


def test_reddit_requests_are_spaced_by_the_gap_after_the_last_one_ended(
    settings: Settings, clock: FakeClock
) -> None:
    fetcher = FakeFeedFetcher(clock, took=timedelta(seconds=2))
    for url in (SUBREDDIT_A, SUBREDDIT_B, NEWS_FEED):
        fetcher.answers[url] = NotModified()
    wiring = app_with(settings, fetcher, clock, SUBREDDIT_A, SUBREDDIT_B, NEWS_FEED)
    start = clock.now()

    wiring.tick.run()

    # The other host doesn't wait for Reddit's gap; the second subreddit waits 10 seconds
    # after the first request finished.
    assert fetcher.asked_at == [
        (SUBREDDIT_A, start),
        (NEWS_FEED, start + timedelta(seconds=2)),
        (SUBREDDIT_B, start + timedelta(seconds=12)),
    ]


def test_a_subreddit_is_checked_at_most_every_reddit_interval(
    settings: Settings, clock: FakeClock
) -> None:
    fetcher = FakeFeedFetcher(clock)
    fetcher.answers = {SUBREDDIT_A: NotModified(), NEWS_FEED: NotModified()}
    wiring = app_with(settings, fetcher, clock, SUBREDDIT_A, NEWS_FEED)
    start = clock.now()

    tick_every_minute(wiring, clock, until=start + timedelta(minutes=90))

    assert minutes_asked(fetcher, SUBREDDIT_A, start) == [0, 60]
    assert minutes_asked(fetcher, NEWS_FEED, start) == [0, 15, 30, 45, 60, 75, 90]


def test_a_retry_delay_holds_the_whole_host_until_it_has_passed(
    settings: Settings, clock: FakeClock
) -> None:
    fetcher = FakeFeedFetcher(clock)
    fetcher.answers = {
        SUBREDDIT_A: RateLimited(retry_after=timedelta(minutes=30)),
        SUBREDDIT_B: NotModified(),
        NEWS_FEED: NotModified(),
    }
    wiring = app_with(settings, fetcher, clock, SUBREDDIT_A, SUBREDDIT_B, NEWS_FEED)
    start = clock.now()

    tick_every_minute(wiring, clock, until=start + timedelta(minutes=45))

    assert minutes_asked(fetcher, SUBREDDIT_B, start) == [30]
    assert minutes_asked(fetcher, NEWS_FEED, start) == [0, 15, 30, 45]


def test_a_rate_limited_source_waits_out_a_retry_delay_longer_than_its_interval(
    settings: Settings, clock: FakeClock
) -> None:
    fetcher = FakeFeedFetcher(clock)
    fetcher.answers = {SUBREDDIT_A: RateLimited(retry_after=timedelta(hours=3))}
    wiring = app_with(settings, fetcher, clock, SUBREDDIT_A)
    start = clock.now()

    tick_every_minute(wiring, clock, until=start + timedelta(hours=3))

    assert minutes_asked(fetcher, SUBREDDIT_A, start) == [0, 180]


def test_a_rate_limit_without_a_retry_delay_backs_off_like_a_failure(
    settings: Settings, clock: FakeClock
) -> None:
    fetcher = FakeFeedFetcher(clock)
    fetcher.answers = {NEWS_FEED: RateLimited(retry_after=None)}
    wiring = app_with(settings, fetcher, clock, NEWS_FEED)
    start = clock.now()

    tick_every_minute(wiring, clock, until=start + timedelta(minutes=45))

    assert minutes_asked(fetcher, NEWS_FEED, start) == [0, 15, 45]


def test_a_failing_source_backs_off_exponentially_and_is_never_disabled(
    settings: Settings, clock: FakeClock
) -> None:
    # No answer set: every request fails to connect.
    fetcher = FakeFeedFetcher(clock)
    wiring = app_with(settings, fetcher, clock, NEWS_FEED)
    start = clock.now()

    tick_every_minute(wiring, clock, until=start + timedelta(minutes=230))
    fetcher.answers[NEWS_FEED] = NotModified()
    tick_every_minute(wiring, clock, until=start + timedelta(minutes=300))

    # 15, 30, then 60 minutes apart, capped at the 60 minute maximum; the first success
    # (at 285) brings back the normal interval.
    assert minutes_asked(fetcher, NEWS_FEED, start) == [0, 15, 45, 105, 165, 225, 285, 300]
