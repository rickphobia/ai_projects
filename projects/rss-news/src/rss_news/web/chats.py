"""Chats over the JSON API: list, create, show, and asking a question, answered in a job with
its progress streamed as server-sent events."""

import logging
from collections.abc import Iterator
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from rss_news.chat.chatting import LONGEST_QUOTE, Chats, ChatSearched, Quote
from rss_news.chat.conversation import ChatFailed, ChatMessage, ChatSummary, NoSuchChat
from rss_news.jobs.running import JobEvent, JobRunning
from rss_news.spending.limit import SpendingStopped
from rss_news.web.jobs import followed, jobs_of

logger = logging.getLogger(__name__)

chats_router = APIRouter(prefix="/api/chats")
_CENT_FRACTION = Decimal("0.01")
# A question, not a document; a selection asked about comes separately, as its quote.
_LONGEST_QUESTION = 4_000
_LONGEST_ORIGIN = 300


class QuotedSelection(BaseModel):
    text: str = Field(min_length=1, max_length=LONGEST_QUOTE)
    # Where it was selected, such as "Item: Fed cuts rates (Reuters)".
    origin: str = Field(min_length=1, max_length=_LONGEST_ORIGIN)


class Question(BaseModel):
    text: str = Field(min_length=1, max_length=_LONGEST_QUESTION)
    # Text the owner selected and chose Ask AI for.
    quote: QuotedSelection | None = None


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
    """A `text/event-stream`: `job` with the id to follow it again by (web/jobs.py), a
    `searched` event (`window`, `count`) for each search the model makes, then `message` with
    the saved answer, or `failed` with a `detail` for the owner. The answer is written in a
    job, so it is saved even if the page is closed. 404 for an unknown Chat, 409 while the
    Chat is still answering, 429 when this month's spending limit is reached."""
    question = body.text.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Ask a question first.")
    jobs = jobs_of(request)
    key = f"chat-{chat_id}"
    if jobs.running(key) is not None:
        raise HTTPException(status_code=409, detail=_STILL_ANSWERING)
    try:
        quote = None if body.quote is None else Quote(body.quote.text, body.quote.origin)
        steps = chats_of(request).ask(chat_id, question, quote)
    except NoSuchChat:
        raise HTTPException(status_code=404, detail="That Chat doesn't exist.") from None
    except SpendingStopped as error:
        raise HTTPException(status_code=429, detail=str(error)) from None
    try:
        job = jobs.start(key, _answered(steps, chat_id), crashed=_failed(_SERVER_TROUBLE))
    except JobRunning:
        # Asked twice at once: the other question won, and this one never runs.
        raise HTTPException(status_code=409, detail=_STILL_ANSWERING) from None
    return followed(job)


_STILL_ANSWERING = "This Chat is still answering your last question."
_SERVER_TROUBLE = "something went wrong on the server; see its logs"


def _answered(steps: Iterator[ChatSearched | ChatMessage], chat_id: int) -> Iterator[JobEvent]:
    try:
        for step in steps:
            if isinstance(step, ChatSearched):
                yield JobEvent("searched", {"window": step.window, "count": step.count})
            else:
                yield JobEvent("message", _message_json(step))
    except ChatFailed as error:
        # The stream has started, so the status is already 200: the failure is an event.
        yield _failed(str(error))
    except Exception:
        # A bug or a database error: still tell the owner, instead of a stream that just stops.
        logger.exception("chat failed unexpectedly", extra={"chat_id": chat_id})
        yield _failed(_SERVER_TROUBLE)


def _failed(reason: str) -> JobEvent:
    return JobEvent("failed", {"detail": f"The Chat couldn't answer: {reason}."})


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
                "importance": item.importance,
                "published_at": None
                if item.published_at is None
                else item.published_at.isoformat(),
            }
            for item in message.items
        ],
    }
