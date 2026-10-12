"""Dictionary: a short definition of a selected word or phrase, fitted to the text around it."""

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from rss_news.spending.ledger import AiUsage, Feature, SpendingLedger
from rss_news.spending.limit import SpendingLimit

logger = logging.getLogger(__name__)

# A word or phrase, not a paragraph: longer selections belong in Ask AI.
LONGEST_TERM = 100
# Enough of the surrounding text to tell which meaning is meant.
LONGEST_CONTEXT = 1_000


class DictionaryFailed(Exception):
    """The model gave no usable definition. `usage` is set when it answered, so the call still
    cost money."""

    def __init__(self, message: str, usage: AiUsage | None = None) -> None:
        super().__init__(message)
        self.usage = usage


@dataclass(frozen=True)
class DefinitionRequest:
    term: str
    # The text the term was selected from, such as its sentence.
    context: str


@dataclass(frozen=True)
class DefinitionResult:
    definition: str
    usage: AiUsage


@dataclass(frozen=True)
class Definition:
    term: str
    definition: str
    cost_usd: Decimal


class DictionaryModel(Protocol):
    def define_word(self, request: DefinitionRequest) -> DefinitionResult:
        """Raises DictionaryFailed when the call fails or gives no definition."""
        ...


class Dictionary:
    def __init__(
        self, *, model: DictionaryModel, ledger: SpendingLedger, limit: SpendingLimit
    ) -> None:
        self._model = model
        self._ledger = ledger
        self._limit = limit

    def define(self, term: str, context: str) -> Definition:
        """Raises SpendingStopped before any call once the monthly limit is reached, and
        DictionaryFailed when the model gives no definition; both calls are recorded."""
        self._limit.check_not_stopped()
        request = DefinitionRequest(
            " ".join(term.split())[:LONGEST_TERM], " ".join(context.split())[:LONGEST_CONTEXT]
        )
        try:
            result = self._model.define_word(request)
        except DictionaryFailed as error:
            if error.usage is not None:
                self._ledger.record(Feature.DICTIONARY, error.usage)
            logger.error("dictionary failed", extra={"detail": str(error)})
            raise
        call = self._ledger.record(Feature.DICTIONARY, result.usage)
        return Definition(request.term, result.definition, call.cost_usd)
