"""What a Chat is, and the ports a Chat turn goes through."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol

from rss_news.spending.ledger import AiUsage


class ChatFailed(Exception):
    """A model call in a Chat turn failed, so the turn did. `usage` is set when the model
    answered, so the call still cost money."""

    def __init__(self, message: str, usage: AiUsage | None = None) -> None:
        super().__init__(message)
        self.usage = usage


class NoSuchChat(Exception):
    """The Chat asked for doesn't exist."""


@dataclass(frozen=True)
class ItemSearch:
    """What the model asked `search_items` for, as it gave it. Every field may be missing; the
    Chat checks and fills them in."""

    folder: str | None
    # ISO 8601 date or date and time in the owner's time zone; None for the last 24 hours.
    since: str | None
    keyword: str | None
    min_importance: int | None


@dataclass(frozen=True)
class SearchCall:
    # The model's id for the call, to send the result back under.
    call_id: str
    search: ItemSearch


@dataclass(frozen=True)
class FoundItem:
    id: int
    title: str
    source_name: str
    folder_name: str
    published_at: datetime
    importance: int | None
    # The one-line summary, or None while unscored.
    summary: str | None


@dataclass(frozen=True)
class SearchResult:
    """What a `search_items` call found, or why it couldn't run."""

    # Such as "the last 24 hours" or "since 2026-10-05"; empty when `error` is set.
    window: str
    # How many Items matched; `items` holds the most important of them.
    count: int
    items: list[FoundItem]
    error: str | None = None

    @classmethod
    def failed(cls, error: str) -> "SearchResult":
        return cls("", 0, [], error)


@dataclass(frozen=True)
class OwnerQuestion:
    text: str
    # The owner's local time, so the model can turn "since Monday" into a date.
    asked_at: datetime
    folder_names: list[str]
    # How many web searches the model may make in this call; 0 when web search isn't offered.
    web_searches_left: int = 0


@dataclass(frozen=True)
class SearchResults:
    results: list[tuple[str, SearchResult]]
    # True when the model may not search again and must answer now.
    last: bool
    web_searches_left: int = 0


type ChatInput = OwnerQuestion | SearchResults


@dataclass(frozen=True)
class AnswerEntry:
    item_id: int
    summary: str


@dataclass(frozen=True)
class ModelAnswer:
    intro: str
    entries: list[AnswerEntry]


@dataclass(frozen=True)
class ChatStep:
    """One model call: either searches to run, or the answer. `context` is the conversation so
    far in the model's own form, passed back on the next call; only the adapter reads it."""

    context: str
    usage: AiUsage
    searches: list[SearchCall]
    answer: ModelAnswer | None


class ChatModel(Protocol):
    def continue_chat(self, context: str, given: ChatInput) -> ChatStep:
        """One model call continuing the conversation in `context` ("" for a new Chat).
        Raises ChatFailed."""
        ...


@dataclass(frozen=True)
class AnswerItem:
    """An Item an answer lists, copied in so it reads well after the Item is deleted."""

    id: int
    title: str
    source_name: str
    summary: str


@dataclass(frozen=True)
class ChatMessage:
    id: int
    created_at: datetime
    # "owner" for a question, "assistant" for an answer.
    role: str
    # The question, or the answer's intro line.
    text: str
    # An answer's Items; empty for a question.
    items: list[AnswerItem]


@dataclass(frozen=True)
class ChatSummary:
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    # What its AI calls cost.
    cost_usd: Decimal


@dataclass(frozen=True)
class Chat:
    summary: ChatSummary
    messages: list[ChatMessage]
    # The model's context, for the next turn.
    context: str


class ChatStore(Protocol):
    def folders(self) -> list[tuple[int, str]]:
        """Every Folder's id and name, in the Folders' order."""
        ...

    def find_items(
        self,
        *,
        since: datetime,
        folder_id: int | None,
        keyword: str | None,
        min_importance: int | None,
        limit: int,
    ) -> tuple[int, list[FoundItem]]:
        """How many Items published at or after `since` match, and the `limit` most important
        of them, newest first within one Importance."""
        ...

    def items_with_ids(self, item_ids: Sequence[int]) -> dict[int, FoundItem]:
        """Those of these Items that still exist, by id."""
        ...

    def create(self, *, created_at: datetime) -> ChatSummary:
        """A Chat with no messages yet; its title is its first question."""
        ...

    def all_newest_first(self) -> list[ChatSummary]: ...

    def get(self, chat_id: int) -> Chat | None: ...

    def add_turn(
        self,
        chat_id: int,
        *,
        question: str,
        answer_intro: str,
        answer_items: Sequence[AnswerItem],
        context: str,
        cost_usd: Decimal,
        at: datetime,
    ) -> ChatMessage:
        """Save a question and its answer together, and the context after them. Gives back the
        saved answer."""
        ...
