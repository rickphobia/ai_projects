"""The FeedFetcher port over HTTP: one conditional GET per call, with httpx."""

import logging
import time
from datetime import timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit

import httpx

from rss_news.clock import Clock
from rss_news.sources.fetching import (
    FeedRequest,
    Fetched,
    FetchFailed,
    FetchResult,
    NotModified,
    RateLimited,
)

logger = logging.getLogger(__name__)

# Feeds are small; a body this large is a mistake or a hostile server, and would cost memory.
MAX_BODY_BYTES = 10 * 1024 * 1024


class HttpFeedFetcher:
    def __init__(
        self,
        *,
        user_agent: str,
        timeout: timedelta,
        clock: Clock,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        # Turns a Retry-After date into a delay.
        self._clock = clock
        # One client for the app's life keeps connections to a host open between fetches.
        # `transport` lets tests answer without a network.
        self._client = httpx.Client(
            headers={"User-Agent": user_agent},
            timeout=timeout.total_seconds(),
            follow_redirects=True,
            transport=transport,
        )

    def fetch(self, request: FeedRequest) -> FetchResult:
        started = time.monotonic()
        result = self._fetch(request)
        logger.info(
            "feed request",
            extra={
                "port": "FeedFetcher",
                "host": urlsplit(request.url).hostname,
                "result": _describe(result),
                "duration_ms": round((time.monotonic() - started) * 1000),
            },
        )
        return result

    def close(self) -> None:
        self._client.close()

    def _fetch(self, request: FeedRequest) -> FetchResult:
        headers = {}
        if request.etag:
            headers["If-None-Match"] = request.etag
        if request.last_modified:
            headers["If-Modified-Since"] = request.last_modified
        try:
            with self._client.stream("GET", request.url, headers=headers) as response:
                if response.status_code == 304:
                    return NotModified()
                if response.status_code == 429:
                    return RateLimited(self._retry_after(response.headers.get("Retry-After")))
                if response.status_code != 200:
                    return FetchFailed("http status", f"answered {response.status_code}")
                body = _read_capped(response)
                if body is None:
                    return FetchFailed("read", f"body is over {MAX_BODY_BYTES} bytes")
                return Fetched(
                    body=body,
                    content_type=response.headers.get("Content-Type"),
                    etag=response.headers.get("ETag"),
                    last_modified=response.headers.get("Last-Modified"),
                )
        except httpx.TimeoutException as error:
            return FetchFailed("timeout", _detail(error))
        except httpx.ConnectError as error:
            return FetchFailed("connect", _detail(error))
        except httpx.TooManyRedirects as error:
            return FetchFailed("redirect", _detail(error))
        except httpx.InvalidURL as error:
            return FetchFailed("url", _detail(error))
        except httpx.HTTPError as error:
            return FetchFailed("http", _detail(error))

    def _retry_after(self, header: str | None) -> timedelta | None:
        """Retry-After as a delay: either seconds or an HTTP date. None when absent or unusable."""
        if header is None:
            return None
        header = header.strip()
        if header.isascii() and header.isdigit():
            return timedelta(seconds=int(header))
        try:
            retry_at = parsedate_to_datetime(header)
        except (TypeError, ValueError):
            logger.warning("unusable Retry-After header", extra={"retry_after": header[:100]})
            return None
        if retry_at.tzinfo is None:
            logger.warning("unusable Retry-After header", extra={"retry_after": header[:100]})
            return None
        return max(retry_at - self._clock.now(), timedelta())


def _read_capped(response: httpx.Response) -> bytes | None:
    chunks: list[bytes] = []
    size = 0
    for chunk in response.iter_bytes():
        size += len(chunk)
        if size > MAX_BODY_BYTES:
            return None
        chunks.append(chunk)
    return b"".join(chunks)


def _detail(error: Exception) -> str:
    return f"{type(error).__name__}: {error}" if str(error) else type(error).__name__


def _describe(result: FetchResult) -> str:
    match result:
        case NotModified():
            return "not modified"
        case Fetched(body=body):
            return f"fetched {len(body)} bytes"
        case FetchFailed(step=step, detail=detail):
            return f"failed at {step}: {detail}"
        case RateLimited(retry_after=retry_after):
            if retry_after is None:
                return "rate limited"
            return f"rate limited, retry after {retry_after.total_seconds():.0f}s"
