"""The spending ledger: one row per AI call, with what it cost."""

import logging
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import Protocol

from rss_news.clock import Clock

logger = logging.getLogger(__name__)

_MILLION = Decimal(1_000_000)


class Feature(StrEnum):
    """What an AI call was made for; the spending page totals by it."""

    SCORING = "scoring"
    BRIEFINGS = "briefings"
    CHAT = "chat"
    DICTIONARY = "dictionary"


@dataclass(frozen=True)
class AiUsage:
    """What one AI call used, as the provider reported it."""

    model: str
    input_tokens: int
    output_tokens: int
    web_searches: int
    duration: timedelta


@dataclass(frozen=True)
class ModelPrice:
    input_usd_per_million: Decimal
    output_usd_per_million: Decimal

    def is_valid(self) -> bool:
        return all(
            price.is_finite() and price >= 0
            for price in (self.input_usd_per_million, self.output_usd_per_million)
        )


@dataclass(frozen=True)
class AiCall:
    """One ledger row."""

    called_at: datetime
    feature: Feature
    usage: AiUsage
    cost_usd: Decimal


class LedgerStore(Protocol):
    def add(self, call: AiCall) -> None: ...

    def calls(self) -> list[AiCall]:
        """Every row, oldest first."""
        ...


class SpendingLedger:
    def __init__(
        self,
        store: LedgerStore,
        clock: Clock,
        *,
        prices: Mapping[str, ModelPrice],
        web_search_price_usd: Decimal,
    ) -> None:
        self._store = store
        self._clock = clock
        self._prices = prices
        self._web_search_price = web_search_price_usd

    def record(self, feature: Feature, usage: AiUsage) -> AiCall:
        """Store one AI call with its cost, and log it."""
        call = AiCall(self._clock.now(), feature, usage, self.cost(usage))
        self._store.add(call)
        logger.info(
            "ai call",
            extra={
                "feature": feature.value,
                "model": usage.model,
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "web_searches": usage.web_searches,
                "cost_usd": str(call.cost_usd),
                "duration_ms": round(usage.duration.total_seconds() * 1000),
            },
        )
        return call

    def calls(self) -> list[AiCall]:
        """Every recorded call, oldest first."""
        return self._store.calls()

    def cost(self, usage: AiUsage) -> Decimal:
        """What a call with this usage costs at the configured prices; also used for estimates."""
        price = self._prices.get(usage.model)
        if price is None:
            # Config checks every configured model has a price, but the provider may answer
            # with another name. Record the call anyway, so its tokens aren't lost.
            logger.warning("no price for model; cost recorded as 0", extra={"model": usage.model})
            return Decimal(0)
        return (
            usage.input_tokens * price.input_usd_per_million / _MILLION
            + usage.output_tokens * price.output_usd_per_million / _MILLION
            + usage.web_searches * self._web_search_price
        )
