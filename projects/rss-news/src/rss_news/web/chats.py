"""Chats over the JSON API: list, create, show, and asking a question with the answer streamed
as server-sent events."""

import json
import logging
from collections.abc import Iterator
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from rss_news.chat.chatting import Chats, ChatSearched
from rss_news.chat.conversation import ChatFailed, ChatMessage, ChatSummary, NoSuchChat
from rss_news.spending.limit import SpendingStopped

logger = logging.getLogger(__name__)

chats_router = APIRouter(prefix="/api/chats")
_CENT_FRACTION = Decimal("0.01")
# A question, not a document; longer text arrives with selections in a later ticket.
_LONGEST_QUESTION = 4_000


class Question(BaseModel):
    text: str = Field(min_length=1, max_length=_LONGEST_QUESTION)


def chats_of(request: Request) -> Chats:
    chats: Chats = request.app.state.chats
    return chats


@chats_router.get("")
def list_chats(request: Request) -> dict[str, Any]:
    """Every saved Chat, the most recently used first, without its messages."""
    return {"chats": [_summary_json(chat) for chat in chats_of(request).all_newest_first()]}


@chats_router.post("", status_code=201)
def create_chat(request: Request) -> dict[str, Any]:
    return {"chat": {**_summary_json(chats_of(request).create()), "messages": []}}


@chats_router.get("/{chat_id}")
def show_chat(request: Request, chat_id: int) -> dict[str, Any]:
    chat = chats_of(request).get(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="That Chat doesn't exist.")
    return {
        "chat": {
            **_summary_json(chat.summary),
            "messages": [_message_json(message) for message in chat.messages],
        }
    }


@chats_router.post("/{chat_id}/messages")
def ask(request: Request, chat_id: int, body: Question) -> StreamingResponse:
    """A `text/event-stream`: a `searched` event (`window`, `count`) for each search the model
    makes, then `message` with the saved answer, or `failed` with a `detail` for the owner.
    404 for an unknown Chat, 429 when this month's spending limit is reached."""
    question = body.text.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Ask a question first.")
    try:
        steps = chats_of(request).ask(chat_id, question)
    except NoSuchChat:
        raise HTTPException(status_code=404, detail="That Chat doesn't exist.") from None
    except SpendingStopped as error:
        raise HTTPException(status_code=429, detail=str(error)) from None
    # no-transform and X-Accel-Buffering keep proxies (the host nginx) from holding events back.
    return StreamingResponse(
        _answered(steps, chat_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


def _answered(steps: Iterator[ChatSearched | ChatMessage], chat_id: int) -> Iterator[str]:
    try:
        for step in steps:
            if isinstance(step, ChatSearched):
                yield _event("searched", {"window": step.window, "count": step.count})
            else:
                yield _event("message", _message_json(step))
    except ChatFailed as error:
        # The stream has started, so the status is already 200: the failure is an event.
        yield _event("failed", {"detail": f"The Chat couldn't answer: {error}."})
    except Exception:
        # A bug or a database error: still tell the owner, instead of a stream that just stops.
        logger.exception("chat failed unexpectedly", extra={"chat_id": chat_id})
        yield _event(
            "failed",
            {
                "detail": "The Chat couldn't answer: something went wrong on the server; "
                "see its logs."
            },
        )


def _event(name: str, data: dict[str, Any]) -> str:
    return f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _summary_json(chat: ChatSummary) -> dict[str, Any]:
    return {
        "id": chat.id,
        "title": chat.title,
        "created_at": chat.created_at.isoformat(),
        "updated_at": chat.updated_at.isoformat(),
        "cost_usd": str(chat.cost_usd.quantize(_CENT_FRACTION)),
    }


def _message_json(message: ChatMessage) -> dict[str, Any]:
    return {
        "id": message.id,
        "role": message.role,
        "created_at": message.created_at.isoformat(),
        "text": message.text,
        "items": [
            {
                "id": item.id,
                "title": item.title,
                "source": item.source_name,
                "summary": item.summary,
            }
            for item in message.items
        ],
    }
