"""One Item over the JSON API: showing it (which marks it read) and its Reader view."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from rss_news.items.reading import ExtractionFailed, ItemNotFound, ItemReading
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
    """The article fetched and cleaned now; 502 with a `detail` for the owner when it can't be."""
    try:
        view = reading_of(request).reader_view(item_id)
    except ItemNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None
    except ExtractionFailed as error:
        raise HTTPException(
            status_code=502, detail=f"Reader view isn't available: {error}."
        ) from None
    return {"title": view.title, "text": view.text}
