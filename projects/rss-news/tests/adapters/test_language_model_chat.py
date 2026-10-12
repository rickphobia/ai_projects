"""A Chat turn with tool use through the Anthropic LanguageModel, against saved responses: the
model searches, gets the results back, then answers."""

import json
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx2
import pytest

from rss_news.chat.conversation import (
    AnswerEntry,
    ChatFailed,
    FoundItem,
    ItemSearch,
    ModelAnswer,
    OwnerQuestion,
    SearchCall,
    SearchResult,
    SearchResults,
)
from tests.adapters.test_language_model import SAVED, model

QUESTION = OwnerQuestion(
    "what happened in Malaysia?",
    datetime(2026, 10, 12, 20, 0, tzinfo=ZoneInfo("Asia/Kuala_Lumpur")),
    ["AI", "Malaysia"],
)
FOUND = SearchResult(
    "the last 24 hours",
    2,
    [
        FoundItem(
            102,
            "BNM kekalkan OPR",
            "Berita Harian",
            "Malaysia",
            datetime(2026, 10, 12, 3, 0, tzinfo=UTC),
            3,
            "BNM held the OPR.",
        ),
        FoundItem(
            105,
            "Ringgit firms",
            "The Star",
            "Malaysia",
            datetime(2026, 10, 12, 9, 0, tzinfo=UTC),
            None,
            None,
        ),
    ],
)


def saved(name: str) -> dict[str, Any]:
    body: dict[str, Any] = json.loads((SAVED / name).read_text())
    return body


def answering(*bodies: dict[str, Any]) -> tuple[Any, list[dict[str, Any]]]:
    """A model that answers each request with the next body, and the requests it got."""
    seen: list[dict[str, Any]] = []
    remaining = list(bodies)

    def answer(request: httpx2.Request) -> httpx2.Response:
        seen.append(json.loads(request.content))
        return httpx2.Response(200, json=remaining.pop(0))

    language_model, _ = model(answer)
    return language_model, seen


def test_a_saved_turn_searches_then_answers_carrying_the_whole_conversation() -> None:
    language_model, seen = answering(
        saved("chat-tool-use-response.json"), saved("chat-answer-response.json")
    )

    searching = language_model.continue_chat("", QUESTION)
    answered = language_model.continue_chat(
        searching.context,
        SearchResults([("toolu_01MalaysiaSearchExample", FOUND)], last=False),
    )

    assert searching.answer is None
    assert searching.searches == [
        SearchCall(
            "toolu_01MalaysiaSearchExample",
            ItemSearch(folder="Malaysia", since=None, keyword=None, min_importance=None),
        )
    ]
    assert (searching.usage.input_tokens, searching.usage.output_tokens) == (1830, 96)
    assert answered.searches == []
    assert answered.answer == ModelAnswer(
        "In the last 24 hours, 2 of 2 Items in Malaysia:",
        [
            AnswerEntry(102, "Bank Negara held the OPR at 2.75%, saying inflation stays moderate."),
            AnswerEntry(105, "The ringgit firmed against the US dollar."),
        ],
    )
    # Cache reads count as input, as the ledger prices them.
    assert answered.usage.input_tokens == 410 + 1920
    first, second = seen
    assert first["model"] == "claude-opus-5-5"
    assert first["output_config"]["effort"] == "low"
    assert first["output_config"]["format"]["type"] == "json_schema"
    assert first["tool_choice"] == {"type": "auto"}
    # Both tools always, so the tool list never changes within a Chat; the message says
    # whether web search may be used.
    assert [tool["name"] for tool in first["tools"]] == ["search_items", "web_search"]
    assert first["tools"][0]["strict"] is True
    assert first["tools"][1] == {
        "type": "web_search_20260318",
        "name": "web_search",
        "max_uses": 5,
    }
    assert first["context_management"] == {
        "edits": [{"type": "compact_20260112", "trigger": {"type": "input_tokens", "value": 70000}}]
    }
    assert "never answer from memory" in first["system"]
    (question,) = first["messages"]
    assert question["content"][0]["text"] == (
        "Now: Monday 2026-10-12 20:00 (+08)\nFolders: AI, Malaysia\n"
        "Web search: not allowed now.\n\n"
        "Question: what happened in Malaysia?"
    )
    # The second call resends the question and the model's whole first answer, thinking
    # included, then the search results under the tool call's id.
    assert second["messages"][:2] == [
        question,
        {"role": "assistant", "content": saved("chat-tool-use-response.json")["content"]},
    ]
    tool_result, allowance = second["messages"][2]["content"]
    assert allowance == {"type": "text", "text": "Web search: not allowed now."}
    assert tool_result["tool_use_id"] == "toolu_01MalaysiaSearchExample"
    assert "is_error" not in tool_result
    result = json.loads(tool_result["content"])
    assert (result["window"], result["count"]) == ("the last 24 hours", 2)
    assert result["items"][0] == {
        "id": 102,
        "title": "BNM kekalkan OPR",
        "source": "Berita Harian",
        "folder": "Malaysia",
        "published_at": "2026-10-12T03:00+00:00",
        "importance": 3,
        "summary": "BNM held the OPR.",
    }
    # The context after the answer holds all four messages, ready for a follow-up.
    assert len(json.loads(answered.context)) == 4


def test_after_the_last_search_the_model_may_not_search_again() -> None:
    language_model, seen = answering(saved("chat-answer-response.json"))
    failed = SearchResult("", 0, [], error="There is no Folder 'Sports'.")

    language_model.continue_chat(
        json.dumps([{"role": "user", "content": "earlier"}]),
        SearchResults([("toolu_1", failed)], last=True),
    )

    (body,) = seen
    assert body["tool_choice"] == {"type": "none"}
    tool_result, note = body["messages"][-1]["content"]
    assert tool_result["is_error"] is True
    assert json.loads(tool_result["content"]) == {"error": "There is no Folder 'Sports'."}
    assert note == {"type": "text", "text": "No more searches: answer now."}


def test_a_refused_turn_fails_with_the_tokens_it_cost() -> None:
    language_model, _ = answering(saved("chat-refusal-response.json"))

    with pytest.raises(ChatFailed, match=r"refusal \(cyber\)") as failure:
        language_model.continue_chat("", QUESTION)
    assert failure.value.usage is not None
    assert failure.value.usage.output_tokens == 158


def test_a_saved_web_search_answer_counts_its_searches_and_compaction() -> None:
    language_model, seen = answering(saved("chat-web-search-response.json"))
    allowed = SearchResults(
        [("toolu_1", SearchResult("the last 24 hours", 0, []))], last=False, web_searches_left=5
    )

    answered = language_model.continue_chat(
        json.dumps([{"role": "user", "content": "earlier"}]), allowed
    )

    (body,) = seen
    assert body["messages"][-1]["content"][-1] == {
        "type": "text",
        "text": "Web search: allowed, at most 5 searches.",
    }
    assert answered.answer == ModelAnswer(
        "No Items covered Bursa today; The Star says the FBM KLCI closed 0.4% higher.", []
    )
    assert answered.usage.web_searches == 2
    # Compaction's own tokens are only in `iterations`, but they are paid for.
    assert (answered.usage.input_tokens, answered.usage.output_tokens) == (
        3200 + 71000,
        240 + 900,
    )
    # The compaction block and the search results are kept for the next call.
    kept = json.loads(answered.context)[-1]["content"]
    assert [block["type"] for block in kept] == [
        "compaction",
        "thinking",
        "server_tool_use",
        "web_search_tool_result",
        "text",
    ]


def test_a_paused_web_search_is_resumed_and_both_calls_are_counted() -> None:
    paused = saved("chat-web-search-response.json")
    paused["stop_reason"] = "pause_turn"
    paused["content"] = paused["content"][1:4]
    paused["usage"]["iterations"] = None
    language_model, seen = answering(paused, saved("chat-answer-response.json"))

    answered = language_model.continue_chat("", QUESTION)

    first, second = seen
    # The resume sends the paused answer back with no new user message.
    assert second["messages"] == [
        *first["messages"],
        {"role": "assistant", "content": paused["content"]},
    ]
    assert answered.answer is not None
    assert answered.usage.web_searches == 2
    assert answered.usage.output_tokens == 240 + 158
    assert len(json.loads(answered.context)) == 3


def test_an_unreachable_model_fails_the_turn_without_usage() -> None:
    language_model, sleeps = model(lambda request: httpx2.Response(503, json={}), max_attempts=2)

    with pytest.raises(ChatFailed, match="HTTP 503") as failure:
        language_model.continue_chat("", QUESTION)
    assert failure.value.usage is None
    assert len(sleeps) == 1
