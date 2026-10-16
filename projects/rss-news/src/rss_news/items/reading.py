"""Reading one Item: showing it, marking it read, and its Reader view fetched on demand."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from rss_news.clock import Clock
from rss_news.items.inbox import InboxItem


class ItemNotFound(Exception):
    """No Item has this id; it may have been removed with its Source."""


class ExtractionFailed(Exception):
    """The original page couldn't be fetched, or held no article text to extract."""


@dataclass(frozen=True)
class ReaderView:
    title: str | None
    # Plain text, paragraphs separated by blank lines.
    text: str
    # Why the original page couldn't be read; `text` is then the feed's preview, or empty.
    problem: str | None = None


@dataclass(frozen=True)
class SourceText:
    """What a Source itself gave for an Item, beside its link."""

    # A short plain-text preview.
    excerpt: str
    # The text in paragraphs, one per line; empty when the Source gave none.
    body: str
    # True when `body` is the whole Item, as for a Reddit text post or a newsletter; with an
    # empty body, the Item is only a picture or video.
    body_complete: bool
    # The article a Reddit link post points to.
    linked_url: str | None


class ArticleExtractor(Protocol):
    def extract(self, url: str) -> ReaderView:
        """Fetch the page and return its article without ads or clutter; raise
        ExtractionFailed when that isn't possible."""
        ...


class ReadableItemStore(Protocol):
    def item(self, item_id: int) -> InboxItem | None: ...

    def source_text(self, item_id: int) -> SourceText | None:
        """What the Source itself gave for the Item; None for an unknown Item."""
        ...

    def mark_read(self, item_id: int, *, at: datetime) -> None:
        """Record when the Item was marked read; marking it again keeps that time."""
        ...

    def mark_unread(self, item_id: int) -> None: ...


class ItemReading:
    def __init__(self, *, items: ReadableItemStore, extractor: ArticleExtractor, clock: Clock):
        self._items = items
        self._extractor = extractor
        self._clock = clock

    def show(self, item_id: int) -> InboxItem:
        """The Item. Showing it leaves it unread: only the owner's Read button marks it."""
        return self._found(item_id)

    def mark_read(self, item_id: int) -> None:
        self._found(item_id)
        self._items.mark_read(item_id, at=self._clock.now())

    def mark_unread(self, item_id: int) -> None:
        self._found(item_id)
        self._items.mark_unread(item_id)

    def reader_view(self, item_id: int) -> ReaderView:
        """The article a Reddit post links to, extracted fresh on every call and never stored;
        else the Item's whole text when its Source gave it (a Reddit text post, a newsletter);
        else the Item's own page. When no page can be read, the Source's text instead, with
        the first reason."""
        found = self._found(item_id)
        given = self._items.source_text(item_id) or SourceText("", "", False, None)
        problem: str | None = None
        if given.linked_url is not None:
            try:
                return self._extractor.extract(given.linked_url)
            except ExtractionFailed as error:
                problem = str(error)
        if given.body_complete:
            if given.body:
                return ReaderView(title=None, text=given.body, problem=problem)
            return ReaderView(title=None, text="", problem="it is a picture or video with no text")
        try:
            return self._extractor.extract(found.url)
        except ExtractionFailed as error:
            problem = problem or str(error)
        return ReaderView(title=None, text=given.body or given.excerpt, problem=problem)

    def _found(self, item_id: int) -> InboxItem:
        found = self._items.item(item_id)
        if found is None:
            raise ItemNotFound(f"no Item with id {item_id}")
        return found
