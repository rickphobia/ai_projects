"""Simple summary: one whole Item explained in plain words, written when the owner asks and
saved for its Item, so reopening the Item shows it again."""

import logging
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol

from rss_news.clock import Clock
from rss_news.items.inbox import InboxItem
from rss_news.items.reading import ReaderView
from rss_news.spending.ledger import AiUsage, Feature, SpendingLedger
from rss_news.spending.limit import SpendingLimit

logger = logging.getLogger(__name__)

# About 10,000 tokens: a long article whole, while one summary stays under a cent.
LONGEST_TEXT = 40_000


class NothingToSummarise(Exception):
    """The Item has no text to summarise, such as a picture post whose page can't be read."""


class SimpleSummaryFailed(Exception):
    """The model gave no usable summary. `usage` is set when it answered, so the call still
    cost money."""

    def __init__(self, message: str, usage: AiUsage | None = None) -> None:
        super().__init__(message)
        self.usage = usage


@dataclass(frozen=True)
class SimpleSummaryRequest:
    title: str
    source_name: str
    text: str


@dataclass(frozen=True)
class WrittenSimpleSummary:
    gist: str
    points: list[str]


@dataclass(frozen=True)
class SimpleSummaryResult:
    summary: WrittenSimpleSummary
    usage: AiUsage


@dataclass(frozen=True)
class SimpleSummary:
    gist: str
    points: list[str]
    # True when the page couldn't be read, so only the Source's preview was summarised.
    from_preview: bool
    cost_usd: Decimal


class SimpleSummaryModel(Protocol):
    def summarise_simply(self, request: SimpleSummaryRequest) -> SimpleSummaryResult:
        """Raises SimpleSummaryFailed when the call fails or gives no summary."""
        ...


class SummarisedItems(Protocol):
    """The Item and its whole text; ItemReading gives both."""

    def show(self, item_id: int) -> InboxItem:
        """Raises ItemNotFound for an unknown Item."""
        ...

    def reader_view(self, item_id: int) -> ReaderView: ...


class SavedSimpleSummaries(Protocol):
    """The latest Simple summary of each Item; it goes when its Item does."""

    def get(self, item_id: int) -> SimpleSummary | None: ...

    def save(self, item_id: int, summary: SimpleSummary, at: datetime) -> None:
        """Replaces the Item's saved summary, if any."""
        ...


class SimpleSummaries:
    def __init__(
        self,
        *,
        items: SummarisedItems,
        store: SavedSimpleSummaries,
        model: SimpleSummaryModel,
        ledger: SpendingLedger,
        limit: SpendingLimit,
        clock: Clock,
    ) -> None:
        self._items = items
        self._store = store
        self._model = model
        self._ledger = ledger
        self._limit = limit
        self._clock = clock

    def saved(self, item_id: int) -> SimpleSummary | None:
        """The Item's last summary, or None before the first. Raises ItemNotFound."""
        self._items.show(item_id)
        return self._store.get(item_id)

    def check_can_summarise(self, item_id: int) -> None:
        """The quick refusals, made before the slow work starts: raises SpendingStopped once
        the monthly limit is reached and ItemNotFound for an unknown Item."""
        self._limit.check_not_stopped()
        self._items.show(item_id)

    def summarise(self, item_id: int) -> SimpleSummary:
        """Write and save a new summary of the Item, replacing the saved one. Raises what
        check_can_summarise does before any call, then NothingToSummarise when the Item has no
        text and SimpleSummaryFailed when the model gives no summary; every model call is
        recorded."""
        self._limit.check_not_stopped()
        item = self._items.show(item_id)
        view = self._items.reader_view(item_id)
        text = view.text.strip()
        if not text:
            raise NothingToSummarise(
                f"there is no text to summarise ({view.problem or 'the page is empty'})"
            )
        request = SimpleSummaryRequest(item.title, item.source_name, text[:LONGEST_TEXT])
        try:
            result = self._model.summarise_simply(request)
        except SimpleSummaryFailed as error:
            if error.usage is not None:
                self._ledger.record(Feature.SIMPLE_SUMMARIES, error.usage)
            logger.error("simple summary failed", extra={"item_id": item_id, "detail": str(error)})
            raise
        call = self._ledger.record(Feature.SIMPLE_SUMMARIES, result.usage)
        summary = SimpleSummary(
            result.summary.gist,
            result.summary.points,
            from_preview=view.problem is not None,
            cost_usd=call.cost_usd,
        )
        self._store.save(item_id, summary, self._clock.now())
        return summary
