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


class ArticleExtractor(Protocol):
    def extract(self, url: str) -> ReaderView:
        """Fetch the page and return its article without ads or clutter; raise
        ExtractionFailed when that isn't possible."""
        ...


class ReadableItemStore(Protocol):
    def item(self, item_id: int) -> InboxItem | None: ...

    def mark_read(self, item_id: int, *, at: datetime) -> None:
        """Record the first time the Item was opened; later opens keep that time."""
        ...


class ItemReading:
    def __init__(self, *, items: ReadableItemStore, extractor: ArticleExtractor, clock: Clock):
        self._items = items
        self._extractor = extractor
        self._clock = clock

    def open(self, item_id: int) -> InboxItem:
        """The Item, now marked read."""
        found = self._found(item_id)
        self._items.mark_read(item_id, at=self._clock.now())
        return found

    def reader_view(self, item_id: int) -> ReaderView:
        """Extracted fresh on every call and never stored, so the database stays small."""
        return self._extractor.extract(self._found(item_id).url)

    def _found(self, item_id: int) -> InboxItem:
        found = self._items.item(item_id)
        if found is None:
            raise ItemNotFound(f"no Item with id {item_id}")
        return found
