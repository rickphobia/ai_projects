"""The HTTP FeedFetcher against httpx's mock transport: no network."""

from collections.abc import Callable
from datetime import timedelta
from email.utils import format_datetime

import httpx
import pytest

from rss_news.adapters.feed_fetcher import MAX_BODY_BYTES, HttpFeedFetcher
from rss_news.sources.fetching import (
    FeedRequest,
    Fetched,
    FetchFailed,
    NotModified,
    RateLimited,
)
from tests.support import FakeClock

URL = "https://example.com/feed.xml"


def fetcher(
    answer: Callable[[httpx.Request], httpx.Response], clock: FakeClock | None = None
) -> HttpFeedFetcher:
    return HttpFeedFetcher(
        user_agent="rss-news-test",
        timeout=timedelta(seconds=5),
        clock=clock or FakeClock(),
        transport=httpx.MockTransport(answer),
    )


def test_a_200_gives_the_body_and_its_caching_headers() -> None:
    seen: list[httpx.Request] = []

    def answer(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            content=b"<rss/>",
            headers={
                "Content-Type": "application/rss+xml",
                "ETag": '"v1"',
                "Last-Modified": "Mon, 12 Oct 2026 08:00:00 GMT",
            },
        )

    result = fetcher(answer).fetch(FeedRequest(URL, etag=None, last_modified=None))

    assert result == Fetched(
        body=b"<rss/>",
        content_type="application/rss+xml",
        etag='"v1"',
        last_modified="Mon, 12 Oct 2026 08:00:00 GMT",
    )
    assert seen[0].headers["User-Agent"] == "rss-news-test"
    assert "If-None-Match" not in seen[0].headers


def test_known_caching_headers_are_sent_and_a_304_is_not_modified() -> None:
    seen: list[httpx.Request] = []

    def answer(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(304)

    result = fetcher(answer).fetch(
        FeedRequest(URL, etag='"v1"', last_modified="Mon, 12 Oct 2026 08:00:00 GMT")
    )

    assert result == NotModified()
    assert seen[0].headers["If-None-Match"] == '"v1"'
    assert seen[0].headers["If-Modified-Since"] == "Mon, 12 Oct 2026 08:00:00 GMT"


def test_an_error_status_is_a_failure_naming_the_status() -> None:
    result = fetcher(lambda _: httpx.Response(404)).fetch(FeedRequest(URL, None, None))

    assert result == FetchFailed("http status", "answered 404")


def test_a_429_with_retry_after_seconds_is_rate_limited_for_that_long() -> None:
    answer = httpx.Response(429, headers={"Retry-After": "120"})

    result = fetcher(lambda _: answer).fetch(FeedRequest(URL, None, None))

    assert result == RateLimited(retry_after=timedelta(seconds=120))


def test_a_429_with_a_retry_after_date_is_rate_limited_until_then() -> None:
    clock = FakeClock()
    retry_at = format_datetime(clock.now() + timedelta(minutes=10), usegmt=True)
    answer = httpx.Response(429, headers={"Retry-After": retry_at})

    result = fetcher(lambda _: answer, clock).fetch(FeedRequest(URL, None, None))

    assert result == RateLimited(retry_after=timedelta(minutes=10))


def test_a_retry_after_date_already_past_means_no_wait() -> None:
    clock = FakeClock()
    retry_at = format_datetime(clock.now() - timedelta(minutes=10), usegmt=True)
    answer = httpx.Response(429, headers={"Retry-After": retry_at})

    result = fetcher(lambda _: answer, clock).fetch(FeedRequest(URL, None, None))

    assert result == RateLimited(retry_after=timedelta())


@pytest.mark.parametrize("headers", [{}, {"Retry-After": "soon"}, {"Retry-After": "-5"}])
def test_a_429_without_a_usable_retry_after_is_rate_limited_with_no_delay_given(
    headers: dict[str, str],
) -> None:
    answer = httpx.Response(429, headers=headers)

    result = fetcher(lambda _: answer).fetch(FeedRequest(URL, None, None))

    assert result == RateLimited(retry_after=None)


def test_a_connection_error_is_a_failure_not_an_exception() -> None:
    def answer(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("name not resolved", request=request)

    result = fetcher(answer).fetch(FeedRequest(URL, None, None))

    assert isinstance(result, FetchFailed)
    assert result.step == "connect"
    assert "name not resolved" in result.detail


def test_a_timeout_is_a_failure() -> None:
    def answer(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("too slow", request=request)

    result = fetcher(answer).fetch(FeedRequest(URL, None, None))

    assert isinstance(result, FetchFailed)
    assert result.step == "timeout"


def test_a_body_over_the_limit_is_refused() -> None:
    huge = b"x" * (MAX_BODY_BYTES + 1)

    result = fetcher(lambda _: httpx.Response(200, content=huge)).fetch(
        FeedRequest(URL, None, None)
    )

    assert isinstance(result, FetchFailed)
    assert result.step == "read"


def test_redirects_are_followed() -> None:
    def answer(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/old":
            return httpx.Response(301, headers={"Location": URL})
        return httpx.Response(200, content=b"<rss/>")

    result = fetcher(answer).fetch(FeedRequest("https://example.com/old", None, None))

    assert isinstance(result, Fetched)
