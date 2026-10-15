"""One Item over the JSON API: showing it (which marks it read) and its Reader view."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from rss_news.items.reading import ItemNotFound, ItemReading
from rss_news.web.inbox import item_json

items_router = APIRouter(prefix="/api/items")


def reading_of(request: Request) -> ItemReading:
    reading: ItemReading = request.app.state.item_reading
    return reading


@items_router.get("/{item_id}")
def show_item(request: Request, item_id: int) -> dict[str, Any]:
    """The Item, marked read from now on."""
    try:
        return item_json(reading_of(request).open(item_id))
    except ItemNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None


@items_router.get("/{item_id}/reader")
def reader_view(request: Request, item_id: int) -> dict[str, Any]:
    """The article fetched and cleaned now. When the page can't be read, `problem` says why and
    `text` is the feed's preview. Always 200 for a known Item: Cloudflare, in front of the site,
    swaps a 5xx body for its own page, which would hide the reason."""
    try:
        view = reading_of(request).reader_view(item_id)
    except ItemNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None
    return {"title": view.title, "text": view.text, "problem": view.problem}
