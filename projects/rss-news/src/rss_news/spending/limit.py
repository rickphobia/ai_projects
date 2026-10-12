"""The monthly spending limit: this month's cost so far, by feature, and whether the features
that can wait (Briefings, Chat, later Dictionary) must stop."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from zoneinfo import ZoneInfo

from rss_news.clock import Clock
from rss_news.spending.ledger import Feature, SpendingLedger

WARNING_SHARE = Decimal("0.8")


class LimitStatus(StrEnum):
    OK = "ok"
    WARNING = "warning"
    STOPPED = "stopped"


class SpendingStopped(Exception):
    """This month's AI cost reached the limit, so a feature that can wait refuses to call."""


@dataclass(frozen=True)
class SpendingSummary:
    # The first moment of this month in the owner's time zone.
    month_start: datetime
    total_usd: Decimal
    # Every Feature, with 0 for those not used this month.
    by_feature: dict[Feature, Decimal]
    limit_usd: Decimal
    status: LimitStatus


class SpendingLimit:
    def __init__(
        self,
        ledger: SpendingLedger,
        clock: Clock,
        *,
        timezone: ZoneInfo,
        monthly_limit_usd: Decimal,
    ) -> None:
        self._ledger = ledger
        self._clock = clock
        self._timezone = timezone
        self._limit = monthly_limit_usd

    def summary(self) -> SpendingSummary:
        month_start = (
            self._clock.now()
            .astimezone(self._timezone)
            .replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        )
        by_feature = {feature: Decimal(0) for feature in Feature}
        for call in self._ledger.calls():
            if call.called_at >= month_start:
                by_feature[call.feature] += call.cost_usd
        total = sum(by_feature.values(), Decimal(0))
        return SpendingSummary(month_start, total, by_feature, self._limit, self._status(total))

    def check_not_stopped(self) -> None:
        """Raises SpendingStopped once this month's cost reaches the limit. Scoring never calls
        this: important news keeps arriving whatever the budget."""
        summary = self.summary()
        if summary.status is LimitStatus.STOPPED:
            raise SpendingStopped(
                f"This month's AI cost (${summary.total_usd:.2f}) has reached the "
                f"${summary.limit_usd:.2f} limit, so Briefings and Chat are off until next month. "
                "Scoring keeps running."
            )

    def _status(self, total: Decimal) -> LimitStatus:
        if total >= self._limit:
            return LimitStatus.STOPPED
        if total >= self._limit * WARNING_SHARE:
            return LimitStatus.WARNING
        return LimitStatus.OK
