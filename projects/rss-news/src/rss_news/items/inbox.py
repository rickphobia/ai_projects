"""Items and the Inbox: storing new Items once each, and listing them newest first."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Protocol

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


class InvalidCursor(Exception):
    """A paging cursor that this Inbox didn't hand out, or handed out for another order."""


class InboxOrder(StrEnum):
    NEWEST = "newest"
    # Highest Importance first, newest first within one Importance; unscored Items last.
    IMPORTANCE = "importance"


@dataclass(frozen=True)
class NewItem:
    source_id: int
    title: str
    # The link as the Source gave it, for opening the Item.
    url: str
    # The link without tracking parameters: an Item with the same one is already stored.
    clean_url: str
    excerpt: str
    published_at: datetime


@dataclass(frozen=True)
class InboxItem:
    id: int
    title: str
    url: str
    source_name: str
    folder_id: int
    folder_name: str
    published_at: datetime
    # Both None until the Item is scored.
    importance: int | None
    summary: str | None


@dataclass(frozen=True)
class InboxPosition:
    """Where a page ended: the next page starts with the Items after this one in the order."""

    published_at: datetime
    item_id: int
    # Only for the Importance order; 0 stands for unscored.
    importance: int | None = None


@dataclass(frozen=True)
class InboxPage:
    items: list[InboxItem]
    # None on the last page.
    next_cursor: str | None


class ItemStore(Protocol):
    def add_new(self, items: Sequence[NewItem]) -> int:
        """Store the Items whose clean URL isn't stored yet; return how many were new."""
        ...

    def listed(
        self,
        *,
        order: InboxOrder,
        folder_id: int | None,
        min_importance: int | None,
        after: InboxPosition | None,
        limit: int,
    ) -> list[InboxItem]:
        """Items in the order (ties broken by newest id), optionally only one Folder's and only
        those scored at least `min_importance`, after a position."""
        ...


class Inbox:
    def __init__(self, items: ItemStore) -> None:
        self._items = items

    def page(
        self,
        *,
        order: InboxOrder = InboxOrder.NEWEST,
        folder_id: int | None = None,
        min_importance: int | None = None,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> InboxPage:
        """One page of the Inbox. Paging by position, not offset, so Items arriving between
        pages don't shift the next page."""
        limit = max(1, min(limit, MAX_PAGE_SIZE))
        after = _decode(cursor, order) if cursor else None
        # One extra Item says whether there is a next page.
        found = self._items.listed(
            order=order,
            folder_id=folder_id,
            min_importance=min_importance,
            after=after,
            limit=limit + 1,
        )
        shown = found[:limit]
        next_cursor = None
        if len(found) > limit:
            last = shown[-1]
            importance = (last.importance or 0) if order is InboxOrder.IMPORTANCE else None
            next_cursor = _encode(InboxPosition(last.published_at, last.id, importance))
        return InboxPage(items=shown, next_cursor=next_cursor)


# Cursors are "<microseconds since 1970 UTC>-<item id>", led by "<importance>-" in the
# Importance order: only digits and dashes, so a cursor pasted into a URL needs no escaping.
_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


def _encode(position: InboxPosition) -> str:
    microseconds = (position.published_at - _EPOCH) // timedelta(microseconds=1)
    cursor = f"{microseconds}-{position.item_id}"
    return cursor if position.importance is None else f"{position.importance}-{cursor}"


def _decode(cursor: str, order: InboxOrder) -> InboxPosition:
    parts = cursor.split("-")
    expected = 3 if order is InboxOrder.IMPORTANCE else 2
    if len(parts) != expected or not all(part.isdigit() for part in parts):
        raise InvalidCursor(f"not an Inbox cursor for the {order.value} order: {cursor!r}")
    numbers = [int(part) for part in parts]
    importance = numbers.pop(0) if order is InboxOrder.IMPORTANCE else None
    microseconds, item_id = numbers
    return InboxPosition(_EPOCH + timedelta(microseconds=microseconds), item_id, importance)
