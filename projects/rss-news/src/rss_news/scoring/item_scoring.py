"""Scoring: giving new Items an Importance, a one-line English summary and the owner's stocks
they mention, in batches."""

import logging
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from itertools import groupby
from typing import Protocol

from rss_news.clock import Clock
from rss_news.scoring.instructions import MAX_IMPORTANCE, MIN_IMPORTANCE, SCORING_INSTRUCTIONS
from rss_news.spending.ledger import AiUsage, Feature, SpendingLedger

logger = logging.getLogger(__name__)

# Each tick makes at most this many scoring calls, and starts none after this long, so a large
# backlog (the first run) or slow answers can't hold up fetching for long. The rest wait for the
# next tick.
MAX_CALLS_PER_TICK = 10
MAX_SCORING_TIME_PER_TICK = timedelta(minutes=2)
# A failed Item waits this long before its first retry, twice as long after each further
# failure, but never longer than the cap.
FIRST_RETRY_DELAY = timedelta(minutes=1)
MAX_RETRY_DELAY = timedelta(hours=6)
# The prompt shows at most this much of an Item's excerpt.
EXCERPT_CHARACTERS = 600
# A rough upper bound for how many tokens a piece of text becomes: real text is nearer 4
# characters per token, so 2 leaves room for other scripts and tokenizer changes.
_CHARACTERS_PER_TOKEN = 2
# The instructions and the answer format sent with every batch, as estimated tokens.
_INSTRUCTION_TOKENS = len(SCORING_INSTRUCTIONS) // _CHARACTERS_PER_TOKEN + 500


class ScoringFailed(Exception):
    """A scoring call failed over its Items, such as a refusal or an answer that isn't the
    scores. `usage` is set when the model answered, so it still cost money."""

    def __init__(self, message: str, usage: AiUsage | None = None) -> None:
        super().__init__(message)
        self.usage = usage


class ScoringUnavailable(Exception):
    """The model can't be reached or won't take calls (network, outage, bad API key), whatever
    the Items. Nothing is held against them; they wait for the next tick."""


@dataclass(frozen=True)
class UnscoredItem:
    id: int
    title: str
    excerpt: str
    source_name: str
    # How many scoring calls with this Item have failed.
    failed_attempts: int


@dataclass(frozen=True)
class ItemScore:
    item_id: int
    importance: int
    # One line, in English whatever the Item's language.
    summary: str
    # The owner's tickers the Item mentions.
    stocks: tuple[str, ...] = ()


@dataclass(frozen=True)
class ScoringResult:
    scores: list[ItemScore]
    usage: AiUsage


class ScoringModel(Protocol):
    def score_items(self, items: Sequence[UnscoredItem], stocks: Sequence[str]) -> ScoringResult:
        """Score every Item in one call, saying which of the `stocks` tickers each mentions.
        Raises ScoringFailed when the call fails over its Items, and ScoringUnavailable when
        any call would fail."""
        ...


class OwnerTickers(Protocol):
    def tickers(self) -> list[str]:
        """Every Watchlist ticker."""
        ...


class ScoringStore(Protocol):
    def unscored(self, *, due_at: datetime, limit: int) -> list[UnscoredItem]:
        """Items without a score whose retry time (if any) has come, fewest failures first,
        then newest first."""
        ...

    def save_scores(self, scores: Sequence[ItemScore], *, at: datetime) -> None: ...

    def record_failures(self, failures: Sequence[tuple[int, datetime]]) -> None:
        """Count one more failed attempt for each (item id, retry at)."""
        ...


class ItemScoring:
    def __init__(
        self,
        *,
        store: ScoringStore,
        model: ScoringModel,
        owner_tickers: OwnerTickers,
        ledger: SpendingLedger,
        clock: Clock,
        batch_size: int,
        prompt_token_limit: int,
    ) -> None:
        self._store = store
        self._model = model
        self._owner_tickers = owner_tickers
        self._ledger = ledger
        self._clock = clock
        self._batch_size = batch_size
        self._prompt_token_limit = prompt_token_limit

    def score_new(self) -> None:
        """Score unscored Items, a batch per call. A failed batch is retried on a later tick;
        the other batches carry on, unless the model is unavailable."""
        started = self._clock.now()
        items = self._store.unscored(due_at=started, limit=self._batch_size * MAX_CALLS_PER_TICK)
        if not items:
            return
        tickers = self._owner_tickers.tickers()
        for batch in self._batches(items)[:MAX_CALLS_PER_TICK]:
            if self._clock.now() - started >= MAX_SCORING_TIME_PER_TICK:
                logger.info("scoring time for this tick used up; the rest wait")
                return
            try:
                self._score(batch, tickers)
            except ScoringUnavailable as error:
                logger.error(
                    "scoring paused until the next tick: the model is unavailable",
                    extra={"detail": str(error)},
                )
                return

    def _batches(self, items: Sequence[UnscoredItem]) -> list[list[UnscoredItem]]:
        """Items that failed before go in smaller batches, halving with each failure, so one
        Item the model can't handle ends up alone instead of failing its neighbours forever."""
        batches: list[list[UnscoredItem]] = []
        for failures, group in groupby(items, key=lambda item: item.failed_attempts):
            size = max(1, self._batch_size >> failures)
            batches.extend(self._split(list(group), size))
        return batches

    def _split(self, items: list[UnscoredItem], size: int) -> list[list[UnscoredItem]]:
        batches: list[list[UnscoredItem]] = []
        batch: list[UnscoredItem] = []
        tokens = _INSTRUCTION_TOKENS
        for item in items:
            item_tokens = estimated_tokens(item)
            if batch and (len(batch) == size or tokens + item_tokens > self._prompt_token_limit):
                batches.append(batch)
                batch, tokens = [], _INSTRUCTION_TOKENS
            batch.append(item)
            tokens += item_tokens
        if batch:
            batches.append(batch)
        return batches

    def _score(self, batch: list[UnscoredItem], tickers: list[str]) -> None:
        ids = [item.id for item in batch]
        try:
            result = self._model.score_items(batch, tickers)
        except ScoringFailed as error:
            if error.usage is not None:
                self._ledger.record(Feature.SCORING, error.usage)
            logger.warning(
                "scoring failed", extra={"items": len(batch), "item_ids": ids, "detail": str(error)}
            )
            self._fail(batch)
            return
        self._ledger.record(Feature.SCORING, result.usage)
        wanted = set(ids)
        scores = [
            _only_owner_stocks(score, tickers)
            for score in result.scores
            if score.item_id in wanted and MIN_IMPORTANCE <= score.importance <= MAX_IMPORTANCE
        ]
        self._store.save_scores(scores, at=self._clock.now())
        scored = {score.item_id for score in scores}
        missing = [item for item in batch if item.id not in scored]
        if missing:
            logger.warning(
                "scoring answer left out items",
                extra={"item_ids": [item.id for item in missing]},
            )
            self._fail(missing)
        logger.info("items scored", extra={"items": len(scores), "failed": len(missing)})

    def _fail(self, items: Sequence[UnscoredItem]) -> None:
        now = self._clock.now()
        self._store.record_failures([(item.id, now + retry_delay(item)) for item in items])


def _only_owner_stocks(score: ItemScore, tickers: Sequence[str]) -> ItemScore:
    """Keep the mentions that are the owner's tickers, once each and in the owner's spelling;
    the model may name others or change the case."""
    by_upper = {ticker.upper(): ticker for ticker in tickers}
    keys = (stock.strip().upper() for stock in score.stocks)
    mentioned = {by_upper[key] for key in keys if key in by_upper}
    return replace(score, stocks=tuple(sorted(mentioned)))


def retry_delay(item: UnscoredItem) -> timedelta:
    """How long to wait after this Item's next failure."""
    return min(FIRST_RETRY_DELAY * (1 << min(item.failed_attempts, 20)), MAX_RETRY_DELAY)


def estimated_tokens(item: UnscoredItem) -> int:
    characters = len(item.title) + min(len(item.excerpt), EXCERPT_CHARACTERS)
    characters += len(item.source_name) + 40  # the id and the markup around each Item
    return characters // _CHARACTERS_PER_TOKEN + 1
