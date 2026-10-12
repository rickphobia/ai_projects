"""The ArticleExtractor port: fetch the page with httpx, then pull the article out with
trafilatura. Nothing is cached or stored."""

import logging
import time
from datetime import timedelta
from urllib.parse import urlsplit

import httpx
import trafilatura

from rss_news.items.reading import ExtractionFailed, ReaderView

logger = logging.getLogger(__name__)

# Article pages are rarely past a few MB; a larger body would only cost memory.
MAX_PAGE_BYTES = 10 * 1024 * 1024


class TrafilaturaArticleExtractor:
    def __init__(
        self,
        *,
        user_agent: str,
        timeout: timedelta,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        # `transport` lets tests answer without a network.
        self._client = httpx.Client(
            headers={"User-Agent": user_agent},
            timeout=timeout.total_seconds(),
            follow_redirects=True,
            transport=transport,
        )

    def extract(self, url: str) -> ReaderView:
        started = time.monotonic()
        result = "ok"
        try:
            return _extracted(self._page(url), url)
        except ExtractionFailed as error:
            result = str(error)
            raise
        finally:
            logger.info(
                "article extraction",
                extra={
                    "port": "ArticleExtractor",
                    "host": urlsplit(url).hostname,
                    "result": result,
                    "duration_ms": round((time.monotonic() - started) * 1000),
                },
            )

    def _page(self, url: str) -> str:
        try:
            with self._client.stream("GET", url) as response:
                if response.status_code != 200:
                    raise ExtractionFailed(f"the page answered HTTP {response.status_code}")
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_PAGE_BYTES:
                        raise ExtractionFailed("the page is too large to read here")
                return bytes(body).decode(response.encoding or "utf-8", errors="replace")
        except httpx.HTTPError as error:
            raise ExtractionFailed(
                f"the page couldn't be fetched ({type(error).__name__})"
            ) from error

    def close(self) -> None:
        self._client.close()


def _extracted(html: str, url: str) -> ReaderView:
    document = trafilatura.bare_extraction(
        html, url=url, include_comments=False, with_metadata=True
    )
    # Without as_dict it returns a Document or None; the dict case only satisfies the types.
    if document is None or isinstance(document, dict) or not (document.text or "").strip():
        raise ExtractionFailed("no article text was found on the page")
    return ReaderView(title=document.title or None, text=(document.text or "").strip())
