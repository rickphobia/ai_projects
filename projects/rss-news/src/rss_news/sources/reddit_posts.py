"""What a Reddit feed entry holds besides the title: Reddit's own page refuses servers, so
Reader view works from these instead."""

import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from rss_news.sources.feed_text import paragraphs

# Reddit marks a text post's body with these comments; a link post has none.
_POST_TEXT = re.compile(r"<!-- SC_OFF -->(.*?)<!-- SC_ON -->", re.DOTALL)
# The "[link]" Reddit adds under every post: the article for a link post, the post itself
# otherwise.
_LINK = re.compile(r"""<a href="([^"]+)">\s*\[link\]\s*</a>""")
_ANY_LINK = re.compile(r'<a href="([^"]+)"')
# A text post shorter than this that links somewhere is a way of sharing that link.
_SHARING_LENGTH = 300


@dataclass(frozen=True)
class RedditPost:
    # The post's own text in paragraphs; empty for a link post.
    text: str
    # The page a link post points to, or a short text post shares, when it is outside Reddit;
    # None otherwise, and for an image or video, which Reader view couldn't read anyway.
    linked_url: str | None
    # True for a picture, video or gallery post: no text and nothing to read anywhere.
    is_media: bool = False


def is_reddit_post(url: str) -> bool:
    host = urlsplit(url).hostname or ""
    return host == "reddit.com" or host.endswith(".reddit.com")


def reddit_post(html: str) -> RedditPost:
    found = _POST_TEXT.search(html)
    post_html = found.group(1) if found else ""
    text = paragraphs(post_html)
    link = _LINK.search(html)
    candidates = [link.group(1)] if link else []
    if text and len(text) < _SHARING_LENGTH:
        candidates += _ANY_LINK.findall(post_html)
    outside = (url.replace("&amp;", "&") for url in candidates)
    return RedditPost(
        text=text,
        linked_url=next((url for url in outside if _outside_reddit(url)), None),
        is_media=not text and link is not None and _is_media(link.group(1)),
    )


def _is_media(url: str) -> bool:
    host = urlsplit(url).hostname or ""
    return host.endswith("redd.it") or "/gallery/" in urlsplit(url).path


def _outside_reddit(url: str) -> bool:
    host = urlsplit(url).hostname or ""
    if not url.lower().startswith(("http://", "https://")):
        return False
    return not (is_reddit_post(url) or host == "redd.it" or host.endswith(".redd.it"))
