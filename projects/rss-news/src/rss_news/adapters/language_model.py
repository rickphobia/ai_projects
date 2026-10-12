"""The LanguageModel port over the Anthropic Messages API."""

import json
import logging
import random
import time
from collections.abc import Callable, Sequence
from datetime import timedelta
from typing import Any, TypeVar

import anthropic
from anthropic.types import Message
from anthropic.types.beta import BetaMessage

from rss_news.adapters.anthropic_chat import (
    ANSWER_SCHEMA,
    SEARCH_ITEMS_TOOL,
    WEB_SEARCH_TOOL,
    chat_input,
    chat_usage,
    search_calls,
)
from rss_news.briefings.briefing import (
    BriefingFailed,
    SectionRequest,
    SectionResult,
    WrittenPoint,
)
from rss_news.briefings.instructions import SECTION_INSTRUCTIONS
from rss_news.chat.conversation import (
    AnswerEntry,
    ChatFailed,
    ChatInput,
    ChatStep,
    ModelAnswer,
    OwnerQuestion,
)
from rss_news.chat.instructions import (
    CHAT_INSTRUCTIONS,
)
from rss_news.config import Effort
from rss_news.scoring.instructions import MAX_IMPORTANCE, MIN_IMPORTANCE, SCORING_INSTRUCTIONS
from rss_news.scoring.item_scoring import (
    EXCERPT_CHARACTERS,
    ItemScore,
    ScoringFailed,
    ScoringResult,
    ScoringUnavailable,
    UnscoredItem,
)
from rss_news.spending.ledger import AiUsage

logger = logging.getLogger(__name__)

# Room for the scores of a full batch plus the model's thinking at low effort.
_SCORING_MAX_TOKENS = 16_000
# Room for a section's points plus the model's thinking.
_SECTION_MAX_TOKENS = 16_000
# Room for a Chat answer or a search call plus the model's thinking.
_CHAT_MAX_TOKENS = 16_000
_MAX_RETRY_DELAY_SECONDS = 60.0
# Times a Chat call is resumed after the API paused a long web search loop.
_CHAT_RESUMES = 3
_COMPACTION_BETA = "compact-2026-01-12"

_Reply = TypeVar("_Reply")

_SCORES_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "importance": {
                        "type": "integer",
                        "enum": list(range(MIN_IMPORTANCE, MAX_IMPORTANCE + 1)),
                    },
                    "summary": {"type": "string"},
                },
                "required": ["id", "importance", "summary"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["scores"],
    "additionalProperties": False,
}

_POINTS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "item_ids": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["text", "item_ids"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["points"],
    "additionalProperties": False,
}


class _CallFailed(Exception):
    """A Messages API call failed after its retries."""

    def __init__(self, message: str, *, about_the_request: bool) -> None:
        super().__init__(message)
        # True when this request's content caused it; otherwise any request would fail.
        self.about_the_request = about_the_request


class AnthropicLanguageModel:
    def __init__(
        self,
        *,
        api_key: str,
        scoring_model: str,
        briefing_model: str,
        briefing_effort: Effort,
        chat_model: str,
        chat_effort: Effort,
        chat_compaction_tokens: int,
        timeout: timedelta,
        max_attempts: int,
        http_client: anthropic.DefaultHttpxClient | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        # The SDK's own retries are off: this class retries, so each retry is logged.
        # `http_client` lets tests answer without a network.
        self._client = anthropic.Anthropic(
            api_key=api_key,
            timeout=timeout.total_seconds(),
            max_retries=0,
            http_client=http_client,
        )
        self._scoring_model = scoring_model
        self._briefing_model = briefing_model
        self._briefing_effort = briefing_effort
        self._chat_model = chat_model
        self._chat_effort = chat_effort
        self._chat_compaction_tokens = chat_compaction_tokens
        self._max_attempts = max_attempts
        self._sleep = sleep

    def score_items(self, items: Sequence[UnscoredItem]) -> ScoringResult:
        started = time.monotonic()
        try:
            message = self._create(
                "score items",
                model=self._scoring_model,
                max_tokens=_SCORING_MAX_TOKENS,
                system=SCORING_INSTRUCTIONS,
                messages=[{"role": "user", "content": _scoring_prompt(items)}],
                output_config={
                    "effort": "low",
                    "format": {"type": "json_schema", "schema": _SCORES_SCHEMA},
                },
            )
        except _CallFailed as error:
            failure = ScoringFailed if error.about_the_request else ScoringUnavailable
            raise failure(str(error)) from error
        usage = _usage(message, self._scoring_model, timedelta(seconds=time.monotonic() - started))
        return ScoringResult(scores=_parse_scores(message, usage), usage=usage)

    def write_briefing_section(self, section: SectionRequest) -> SectionResult:
        started = time.monotonic()
        try:
            message = self._create(
                "write briefing section",
                model=self._briefing_model,
                max_tokens=_SECTION_MAX_TOKENS,
                system=SECTION_INSTRUCTIONS,
                messages=[{"role": "user", "content": _section_prompt(section)}],
                output_config={
                    "effort": self._briefing_effort,
                    "format": {"type": "json_schema", "schema": _POINTS_SCHEMA},
                },
            )
        except _CallFailed as error:
            raise BriefingFailed(str(error)) from error
        usage = _usage(message, self._briefing_model, timedelta(seconds=time.monotonic() - started))
        return SectionResult(points=_parse_points(message, usage), usage=usage)

    def continue_chat(self, context: str, given: ChatInput) -> ChatStep:
        """`context` is the Messages API conversation as JSON. The full assistant content,
        thinking, web searches and compaction included, goes back into it after each call, as
        tool use and compaction need."""
        messages: list[dict[str, Any]] = json.loads(context) if context else []
        messages.append({"role": "user", "content": chat_input(given)})
        last = not isinstance(given, OwnerQuestion) and given.last
        started = time.monotonic()
        message = self._chat_call(messages, last=last, spent=None)
        usage = self._chat_usage(message, started, before=None)
        resumes = 0
        # A long web search loop pauses; sending the conversation back resumes it.
        while message.stop_reason == "pause_turn" and resumes < _CHAT_RESUMES:
            resumes += 1
            logger.info("chat call resumed after pause_turn", extra={"model": self._chat_model})
            message = self._chat_call(messages, last=last, spent=usage)
            usage = self._chat_usage(message, started, before=usage)
        updated = json.dumps(messages, ensure_ascii=False)
        if message.stop_reason == "tool_use":
            return ChatStep(updated, usage, search_calls(message, usage), None)
        return ChatStep(updated, usage, [], _parse_answer(message, usage))

    def _chat_usage(
        self, message: BetaMessage, started: float, *, before: AiUsage | None
    ) -> AiUsage:
        duration = timedelta(seconds=time.monotonic() - started)
        return chat_usage(message, self._chat_model, duration, before=before)

    def _chat_call(
        self, messages: list[dict[str, Any]], *, last: bool, spent: AiUsage | None
    ) -> BetaMessage:
        """One call; its whole answer is appended to `messages`."""
        params: dict[str, Any] = {
            "betas": [_COMPACTION_BETA],
            "model": self._chat_model,
            "max_tokens": _CHAT_MAX_TOKENS,
            "system": CHAT_INSTRUCTIONS,
            "messages": messages,
            "tools": [SEARCH_ITEMS_TOOL, WEB_SEARCH_TOOL],
            # After the last allowed search the model must answer.
            "tool_choice": {"type": "none"} if last else {"type": "auto"},
            # Follow-ups and searches resend the conversation; caching makes that cheap.
            "cache_control": {"type": "ephemeral"},
            # Past the threshold the API summarises older turns into a compaction block.
            "context_management": {
                "edits": [
                    {
                        "type": "compact_20260112",
                        "trigger": {"type": "input_tokens", "value": self._chat_compaction_tokens},
                    }
                ]
            },
            "output_config": {
                "effort": self._chat_effort,
                "format": {"type": "json_schema", "schema": ANSWER_SCHEMA},
            },
        }
        try:
            message: BetaMessage = self._retrying(
                "continue chat",
                self._chat_model,
                lambda: self._client.beta.messages.create(**params),
            )
        except _CallFailed as error:
            # A resumed call that fails still leaves the paused calls' cost.
            raise ChatFailed(str(error), spent) from error
        messages.append(
            {"role": "assistant", "content": [block.to_dict() for block in message.content]}
        )
        return message

    def close(self) -> None:
        self._client.close()

    def _create(self, operation: str, **params: Any) -> Message:
        message: Message = self._retrying(
            operation, params["model"], lambda: self._client.messages.create(**params)
        )
        return message

    def _retrying(self, operation: str, model: str, call: Callable[[], _Reply]) -> _Reply:
        """One Messages API call, tried again with backoff on network errors, 429 and 5xx."""
        for attempt in range(1, self._max_attempts + 1):
            try:
                return call()
            except (anthropic.APIConnectionError, anthropic.APIStatusError) as error:
                if not _is_retryable(error) or attempt == self._max_attempts:
                    logger.error(
                        "ai call failed",
                        extra={
                            "operation": operation,
                            "model": model,
                            "attempts": attempt,
                            "detail": _detail(error),
                        },
                    )
                    raise _CallFailed(
                        f"{operation} failed: {_detail(error)}",
                        about_the_request=_is_about_the_request(error),
                    ) from error
                delay = _retry_delay(error, attempt)
                logger.warning(
                    "ai call retried",
                    extra={
                        "operation": operation,
                        "model": model,
                        "attempt": attempt,
                        "delay_seconds": round(delay, 1),
                        "detail": _detail(error),
                    },
                )
                self._sleep(delay)
        raise AssertionError("unreachable: the last attempt returns or raises")


def _scoring_prompt(items: Sequence[UnscoredItem]) -> str:
    listed = [
        {
            "id": item.id,
            "source": item.source_name,
            "title": item.title,
            "excerpt": item.excerpt[:EXCERPT_CHARACTERS],
        }
        for item in items
    ]
    return "Score these Items:\n" + json.dumps(listed, ensure_ascii=False)


def _section_prompt(section: SectionRequest) -> str:
    listed = [
        {
            "id": item.id,
            "source": item.source_name,
            "title": item.title,
            "importance": item.importance,
            "summary": item.summary,
            **({"full_text": item.full_text} if item.full_text is not None else {}),
        }
        for item in section.items
    ]
    return f"Write the {section.folder_name} section from these Items:\n" + json.dumps(
        listed, ensure_ascii=False
    )


def _parse_answer(message: Message | BetaMessage, usage: AiUsage) -> ModelAnswer:
    if (stopped := _stop_detail(message)) is not None:
        raise ChatFailed(f"no answer: {stopped}", usage)
    try:
        answer = json.loads(_answer_text(message))
        return ModelAnswer(
            intro=" ".join(str(answer["intro"]).split()),
            entries=[
                AnswerEntry(int(entry["item_id"]), " ".join(str(entry["summary"]).split()))
                for entry in answer["items"]
            ],
        )
    except (ValueError, KeyError, TypeError) as error:
        raise ChatFailed(f"answer is not the Chat answer JSON: {error}", usage) from error


def _usage(message: Message, model: str, duration: timedelta) -> AiUsage:
    """`model` is the name asked for, not `message.model`: the prices are keyed by it, and the
    API may answer with a dated snapshot name."""
    server_tools = message.usage.server_tool_use
    return AiUsage(
        model=model,
        input_tokens=message.usage.input_tokens
        + (message.usage.cache_read_input_tokens or 0)
        + (message.usage.cache_creation_input_tokens or 0),
        output_tokens=message.usage.output_tokens,
        web_searches=server_tools.web_search_requests if server_tools else 0,
        duration=duration,
    )


def _stop_detail(message: Message | BetaMessage) -> str | None:
    """Why the model stopped, when it isn't a finished answer."""
    if message.stop_reason == "end_turn":
        return None
    detail = f"stop reason {message.stop_reason}"
    if message.stop_details is not None:
        detail += f" ({message.stop_details.category})"
    return detail


def _answer_text(message: Message | BetaMessage) -> str:
    return "".join(block.text for block in message.content if block.type == "text")


def _parse_scores(message: Message, usage: AiUsage) -> list[ItemScore]:
    if (stopped := _stop_detail(message)) is not None:
        raise ScoringFailed(f"no scores in the answer: {stopped}", usage)
    text = _answer_text(message)
    try:
        answer = json.loads(text)
        return [
            ItemScore(
                item_id=int(score["id"]),
                importance=int(score["importance"]),
                summary=" ".join(str(score["summary"]).split()),
            )
            for score in answer["scores"]
        ]
    except (ValueError, KeyError, TypeError) as error:
        raise ScoringFailed(f"answer is not the scores JSON: {error}", usage) from error


def _parse_points(message: Message, usage: AiUsage) -> list[WrittenPoint]:
    if (stopped := _stop_detail(message)) is not None:
        raise BriefingFailed(f"no section in the answer: {stopped}", usage)
    try:
        answer = json.loads(_answer_text(message))
        return [
            WrittenPoint(
                text=" ".join(str(point["text"]).split()),
                item_ids=[int(item_id) for item_id in point["item_ids"]],
            )
            for point in answer["points"]
        ]
    except (ValueError, KeyError, TypeError) as error:
        raise BriefingFailed(f"answer is not the section JSON: {error}", usage) from error


def _is_retryable(error: anthropic.APIConnectionError | anthropic.APIStatusError) -> bool:
    if isinstance(error, anthropic.APIConnectionError):
        return True  # includes timeouts
    return error.status_code in (408, 409, 429) or error.status_code >= 500


def _is_about_the_request(
    error: anthropic.APIConnectionError | anthropic.APIStatusError,
) -> bool:
    """True for errors this request's content caused (400, 413, 422); auth, a missing model,
    rate limits, outages and network errors would fail any request."""
    return isinstance(error, anthropic.APIStatusError) and error.status_code in (400, 413, 422)


def _retry_delay(error: Exception, attempt: int) -> float:
    delay = 2.0 ** (attempt - 1) + random.uniform(0, 1)
    if isinstance(error, anthropic.APIStatusError):
        retry_after = error.response.headers.get("retry-after", "")
        if retry_after.replace(".", "", 1).isdigit():
            delay = max(delay, float(retry_after))
    return min(delay, _MAX_RETRY_DELAY_SECONDS)


def _detail(error: Exception) -> str:
    if isinstance(error, anthropic.APIStatusError):
        return f"HTTP {error.status_code} ({error.request_id}): {error.message}"
    return f"{type(error).__name__}: {error}"
