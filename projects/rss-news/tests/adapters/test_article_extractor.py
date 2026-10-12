"""The trafilatura ArticleExtractor against a saved article page, over httpx's mock transport."""

from collections.abc import Callable
from datetime import timedelta
from pathlib import Path

import httpx
import pytest

from rss_news.adapters.article_extractor import MAX_PAGE_BYTES, TrafilaturaArticleExtractor
from rss_news.items.reading import ExtractionFailed

URL = "https://news.example/business/bnm-holds-rates"
ARTICLE = (Path(__file__).parent / "pages" / "news-article.html").read_bytes()


def extractor(answer: Callable[[httpx.Request], httpx.Response]) -> TrafilaturaArticleExtractor:
    return TrafilaturaArticleExtractor(
        user_agent="rss-news-test",
        timeout=timedelta(seconds=5),
        transport=httpx.MockTransport(answer),
    )


def html(body: bytes) -> Callable[[httpx.Request], httpx.Response]:
    return lambda _: httpx.Response(
        200, content=body, headers={"Content-Type": "text/html; charset=utf-8"}
    )


def test_the_article_text_is_kept_and_the_clutter_dropped() -> None:
    view = extractor(html(ARTICLE)).extract(URL)

    assert view.title == "Malaysia's central bank holds rates as ringgit firms"
    assert "kept its overnight policy rate at 2.75 per cent" in view.text
    assert "would act if the outlook for inflation shifted" in view.text
    for clutter in ("ADVERTISEMENT", "Subscribe", "Copyright", "Cookie settings"):
        assert clutter not in view.text


def test_the_request_carries_the_user_agent() -> None:
    seen: list[httpx.Request] = []

    def answer(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, content=ARTICLE)

    extractor(answer).extract(URL)

    assert seen[0].headers["User-Agent"] == "rss-news-test"


def test_an_error_status_fails_with_it() -> None:
    with pytest.raises(ExtractionFailed, match="HTTP 403"):
        extractor(lambda _: httpx.Response(403)).extract(URL)


def test_a_page_without_article_text_fails() -> None:
    with pytest.raises(ExtractionFailed, match="no article text"):
        extractor(html(b"<html><body><script>app()</script></body></html>")).extract(URL)


def test_a_network_error_fails() -> None:
    def answer(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(ExtractionFailed, match="ConnectError"):
        extractor(answer).extract(URL)


def test_a_page_past_the_size_limit_fails() -> None:
    with pytest.raises(ExtractionFailed, match="too large"):
        extractor(html(b"x" * (MAX_PAGE_BYTES + 1))).extract(URL)
