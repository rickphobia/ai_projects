"""One Item over the JSON API: showing it, its Reader view, and marking it read or unread."""

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
    try:
        return item_json(reading_of(request).show(item_id))
    except ItemNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None


@items_router.put("/{item_id}/read", status_code=204)
def mark_read(request: Request, item_id: int) -> None:
    """Marks the Item read, which takes it out of the Inbox's Unread view."""
    try:
        reading_of(request).mark_read(item_id)
    except ItemNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None


@items_router.delete("/{item_id}/read", status_code=204)
def mark_unread(request: Request, item_id: int) -> None:
    try:
        reading_of(request).mark_unread(item_id)
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
