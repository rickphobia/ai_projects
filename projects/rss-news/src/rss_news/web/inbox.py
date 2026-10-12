"""The Inbox over the JSON API: Items in order, filtered by Folder and Importance, a page at a
time."""

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, Request

from rss_news.items.inbox import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    Inbox,
    InboxItem,
    InboxOrder,
    InvalidCursor,
)
from rss_news.scoring.instructions import MAX_IMPORTANCE, MIN_IMPORTANCE

inbox_router = APIRouter(prefix="/api")


def inbox_of(request: Request) -> Inbox:
    inbox: Inbox = request.app.state.inbox
    return inbox


@inbox_router.get("/inbox")
def list_inbox(
    request: Request,
    folder: int | None = None,
    min_importance: Annotated[int | None, Query(ge=MIN_IMPORTANCE, le=MAX_IMPORTANCE)] = None,
    sort: InboxOrder = InboxOrder.NEWEST,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    """`folder` limits the page to one Folder and `min_importance` to Items scored at least
    that; `sort` is `newest` or `importance`; `cursor` is the last page's `next_cursor`."""
    try:
        page = inbox_of(request).page(
            order=sort,
            folder_id=folder,
            min_importance=min_importance,
            cursor=cursor,
            limit=limit,
        )
    except InvalidCursor as error:
        raise HTTPException(status_code=400, detail=str(error)) from None
    return {"items": [_item_json(item) for item in page.items], "next_cursor": page.next_cursor}


def _item_json(item: InboxItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "url": item.url,
        "source": item.source_name,
        "folder": {"id": item.folder_id, "name": item.folder_name},
        "published_at": item.published_at.isoformat(),
        "importance": item.importance,
        "summary": item.summary,
    }
