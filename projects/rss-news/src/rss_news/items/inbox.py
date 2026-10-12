"""Items and the Inbox: storing new Items once each, and listing them newest first."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


class InvalidCursor(Exception):
    """A paging cursor that this Inbox didn't hand out."""


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


@dataclass(frozen=True)
class InboxPosition:
    """Where a page ended: the next page starts with the Items older than this one."""

    published_at: datetime
    item_id: int


@dataclass(frozen=True)
class InboxPage:
    items: list[InboxItem]
    # None on the last page.
    next_cursor: str | None


class ItemStore(Protocol):
    def add_new(self, items: Sequence[NewItem]) -> int:
        """Store the Items whose clean URL isn't stored yet; return how many were new."""
        ...

    def newest_first(
        self, *, folder_id: int | None, after: InboxPosition | None, limit: int
    ) -> list[InboxItem]:
        """Items newest first (ties broken by id), optionally in one Folder, after a position."""
        ...


class Inbox:
    def __init__(self, items: ItemStore) -> None:
        self._items = items

    def page(
        self,
        *,
        folder_id: int | None = None,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> InboxPage:
        """One page of the Inbox. Paging by position, not offset, so Items arriving between
        pages don't shift the next page."""
        limit = max(1, min(limit, MAX_PAGE_SIZE))
        after = _decode(cursor) if cursor else None
        # One extra Item says whether there is a next page.
        found = self._items.newest_first(folder_id=folder_id, after=after, limit=limit + 1)
        shown = found[:limit]
        next_cursor = None
        if len(found) > limit:
            last = shown[-1]
            next_cursor = _encode(InboxPosition(last.published_at, last.id))
        return InboxPage(items=shown, next_cursor=next_cursor)


def _encode(position: InboxPosition) -> str:
    return f"{position.published_at.isoformat()}~{position.item_id}"


def _decode(cursor: str) -> InboxPosition:
    published, _, item_id = cursor.rpartition("~")
    try:
        moment = datetime.fromisoformat(published)
        if moment.utcoffset() is None:
            raise ValueError("no time zone")
        return InboxPosition(moment, int(item_id))
    except ValueError:
        raise InvalidCursor(f"not an Inbox cursor: {cursor!r}") from None
