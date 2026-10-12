"""Chat turns in the Messages API's terms: the answer schema, the `search_items` tool, what
the model is sent for each ChatInput, and the searches it asks for."""

import json
from typing import Any

from anthropic.types import Message

from rss_news.chat.conversation import (
    ChatFailed,
    ChatInput,
    ItemSearch,
    OwnerQuestion,
    SearchCall,
    SearchResult,
)
from rss_news.chat.instructions import SEARCH_ITEMS_DESCRIPTION, SEARCH_ITEMS_TOOL_NAME
from rss_news.spending.ledger import AiUsage

ANSWER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "intro": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "integer"},
                    "summary": {"type": "string"},
                },
                "required": ["item_id", "summary"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["intro", "items"],
    "additionalProperties": False,
}

SEARCH_ITEMS_TOOL: dict[str, Any] = {
    "name": SEARCH_ITEMS_TOOL_NAME,
    "description": SEARCH_ITEMS_DESCRIPTION,
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "folder": {
                "type": ["string", "null"],
                "description": "One of the reader's Folders, by name",
            },
            "since": {
                "type": ["string", "null"],
                "description": "Start of the window: an ISO 8601 date, or date and time, in "
                "the reader's time zone, such as 2026-10-05",
            },
            "keyword": {
                "type": ["string", "null"],
                "description": "Words that must all appear in the title, excerpt or summary",
            },
            "min_importance": {
                "type": ["integer", "null"],
                "description": "Only Items with at least this Importance, 1 to 5",
            },
        },
        "required": ["folder", "since", "keyword", "min_importance"],
        "additionalProperties": False,
    },
}


def chat_input(given: ChatInput) -> list[dict[str, Any]]:
    if isinstance(given, OwnerQuestion):
        asked = f"{given.asked_at:%A %Y-%m-%d %H:%M} ({given.asked_at.tzname()})"
        folders = ", ".join(given.folder_names)
        text = f"Now: {asked}\nFolders: {folders}\n\nQuestion: {given.text}"
        return [{"type": "text", "text": text}]
    blocks: list[dict[str, Any]] = [
        {
            "type": "tool_result",
            "tool_use_id": call_id,
            "content": json.dumps(_search_result_json(result), ensure_ascii=False),
            **({"is_error": True} if result.error is not None else {}),
        }
        for call_id, result in given.results
    ]
    if given.last:
        blocks.append({"type": "text", "text": "No more searches: answer now."})
    return blocks


def _search_result_json(result: SearchResult) -> dict[str, Any]:
    if result.error is not None:
        return {"error": result.error}
    return {
        "window": result.window,
        "count": result.count,
        "items": [
            {
                "id": item.id,
                "title": item.title,
                "source": item.source_name,
                "folder": item.folder_name,
                "published_at": item.published_at.isoformat(timespec="minutes"),
                "importance": item.importance,
                "summary": item.summary,
            }
            for item in result.items
        ],
    }


def search_calls(message: Message, usage: AiUsage) -> list[SearchCall]:
    calls = []
    for block in message.content:
        if block.type != "tool_use":
            continue
        if block.name != SEARCH_ITEMS_TOOL_NAME:
            raise ChatFailed(f"the model called an unknown tool {block.name!r}", usage)
        given: dict[str, Any] = block.input if isinstance(block.input, dict) else {}
        importance = given.get("min_importance")
        calls.append(
            SearchCall(
                block.id,
                ItemSearch(
                    folder=_text_or_none(given.get("folder")),
                    since=_text_or_none(given.get("since")),
                    keyword=_text_or_none(given.get("keyword")),
                    min_importance=importance if isinstance(importance, int) else None,
                ),
            )
        )
    if not calls:
        raise ChatFailed("the model stopped to use a tool but called none", usage)
    return calls


def _text_or_none(value: object) -> str | None:
    return value if isinstance(value, str) and value.strip() else None
