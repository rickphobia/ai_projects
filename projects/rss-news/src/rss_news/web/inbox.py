"""The Inbox over the JSON API: Items newest first, filtered by Folder, a page at a time."""

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, Request

from rss_news.items.inbox import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, Inbox, InboxItem, InvalidCursor

inbox_router = APIRouter(prefix="/api")


def inbox_of(request: Request) -> Inbox:
    inbox: Inbox = request.app.state.inbox
    return inbox


@inbox_router.get("/inbox")
def list_inbox(
    request: Request,
    folder: int | None = None,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    """`folder` limits the page to one Folder; `cursor` is the last page's `next_cursor`."""
    try:
        page = inbox_of(request).page(folder_id=folder, cursor=cursor, limit=limit)
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
    }
