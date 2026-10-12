"""Chat turns in the Messages API's terms: the answer schema, the `search_items` and web
search tools, what the model is sent for each ChatInput, and the searches it asks for."""

import json
from datetime import timedelta
from typing import Any

from anthropic.types.beta import BetaMessage

from rss_news.chat.chatting import WEB_SEARCHES_PER_QUESTION
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

# Always sent, so the tool list never changes within a Chat: a changed list would invalidate the
# cached prefix and the thinking blocks passed back. Whether the model may use it is said in
# each message instead (decision 0006).
WEB_SEARCH_TOOL: dict[str, Any] = {
    "type": "web_search_20260318",
    "name": "web_search",
    "max_uses": WEB_SEARCHES_PER_QUESTION,
}


def chat_input(given: ChatInput) -> list[dict[str, Any]]:
    if isinstance(given, OwnerQuestion):
        asked = f"{given.asked_at:%A %Y-%m-%d %H:%M} ({given.asked_at.tzname()})"
        folders = ", ".join(given.folder_names)
        text = (
            f"Now: {asked}\nFolders: {folders}\n{_web_allowance(given.web_searches_left)}\n\n"
            f"Question: {given.text}"
        )
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
    else:
        blocks.append({"type": "text", "text": _web_allowance(given.web_searches_left)})
    return blocks


def _web_allowance(searches_left: int) -> str:
    if searches_left <= 0:
        return "Web search: not allowed now."
    return f"Web search: allowed, at most {searches_left} searches."


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


def search_calls(message: BetaMessage, usage: AiUsage) -> list[SearchCall]:
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


def chat_usage(
    message: BetaMessage, model: str, duration: timedelta, *, before: AiUsage | None
) -> AiUsage:
    """What a Chat call used, added to `before` when it resumes a paused call. Compaction's
    own tokens are reported only in `iterations`, so they are added here to be paid for.
    `model` is the name asked for, as the prices are keyed by it."""
    reported = message.usage
    compaction = [entry for entry in reported.iterations or [] if entry.type == "compaction"]
    input_tokens = sum(
        entry.input_tokens + entry.cache_read_input_tokens + entry.cache_creation_input_tokens
        for entry in compaction
    ) + (
        reported.input_tokens
        + (reported.cache_read_input_tokens or 0)
        + (reported.cache_creation_input_tokens or 0)
    )
    output_tokens = reported.output_tokens + sum(entry.output_tokens for entry in compaction)
    server_tools = reported.server_tool_use
    web_searches = server_tools.web_search_requests if server_tools else 0
    if before is not None:
        input_tokens += before.input_tokens
        output_tokens += before.output_tokens
        web_searches += before.web_searches
    return AiUsage(
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        web_searches=web_searches,
        duration=duration,
    )
