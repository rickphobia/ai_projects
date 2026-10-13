"""Alert rules: after a tick scores new Items, which of them send an Alert, kept to one per Item,
out of quiet hours and under the daily cap."""

import logging
from dataclasses import dataclass
from datetime import datetime, time
from enum import StrEnum
from typing import Protocol
from zoneinfo import ZoneInfo

from rss_news.alerts.push import Alert, AlertPush
from rss_news.clock import Clock

logger = logging.getLogger(__name__)

ALERT_IMPORTANCE = 5


class AlertOutcome(StrEnum):
    """What the rules decided for a scored Item. Every outcome is final: a dropped Alert is
    never sent later."""

    SENT = "sent"
    NO_RULE = "no_rule"
    QUIET_HOURS = "quiet_hours"
    DAILY_CAP = "daily_cap"
    # No phone had Alerts on, or the server has no VAPID key.
    NOBODY_TO_SEND_TO = "nobody_to_send_to"


@dataclass(frozen=True)
class QuietHours:
    """Times of day in the owner's time zone when no Alerts are sent, from `start` up to but
    not including `end`. A start after the end runs over midnight; equal times mean none."""

    start: time
    end: time

    def contain(self, moment: time) -> bool:
        if self.start <= self.end:
            return self.start <= moment < self.end
        return moment >= self.start or moment < self.end


@dataclass(frozen=True)
class AlertLimits:
    quiet_hours: QuietHours
    daily_cap: int
    timezone: ZoneInfo


@dataclass(frozen=True)
class ScoredItem:
    id: int
    title: str
    summary: str
    importance: int
    # The Watchlist tickers it mentions.
    stocks: tuple[str, ...]


class AlertStore(Protocol):
    def undecided(self) -> list[ScoredItem]:
        """Scored Items the rules haven't looked at yet, oldest score first."""
        ...

    def decide(self, item_id: int, outcome: AlertOutcome, *, at: datetime) -> None: ...

    def sent_since(self, moment: datetime) -> int:
        """How many Alerts were sent from `moment` on."""
        ...


class AlertRules:
    def __init__(
        self, *, store: AlertStore, push: AlertPush, clock: Clock, limits: AlertLimits
    ) -> None:
        self._store = store
        self._push = push
        self._clock = clock
        self.limits = limits

    def send_due(self) -> None:
        """Decide every newly scored Item: send its Alert, or drop it with the reason."""
        items = self._store.undecided()
        if not items:
            return
        now = self._clock.now()
        local = now.astimezone(self.limits.timezone)
        start_of_day = local.replace(hour=0, minute=0, second=0, microsecond=0)
        sent_today = self._store.sent_since(start_of_day)
        can_send = self._push.application_server_key is not None and (
            self._push.subscription_count() > 0
        )
        for item in items:
            outcome = self._outcome(item, local.time(), sent_today, can_send)
            if outcome is AlertOutcome.SENT:
                self._send(item)
                sent_today += 1
            elif outcome is not AlertOutcome.NO_RULE:
                logger.info("alert dropped", extra={"item_id": item.id, "reason": outcome.value})
            # One at a time, so an Alert already sent isn't sent again if a later one fails.
            self._store.decide(item.id, outcome, at=now)

    def _outcome(
        self, item: ScoredItem, local_time: time, sent_today: int, can_send: bool
    ) -> AlertOutcome:
        if not item.stocks and item.importance < ALERT_IMPORTANCE:
            return AlertOutcome.NO_RULE
        if self.limits.quiet_hours.contain(local_time):
            return AlertOutcome.QUIET_HOURS
        if sent_today >= self.limits.daily_cap:
            return AlertOutcome.DAILY_CAP
        if not can_send:
            return AlertOutcome.NOBODY_TO_SEND_TO
        return AlertOutcome.SENT

    def _send(self, item: ScoredItem) -> None:
        title = f"{', '.join(item.stocks)}: {item.title}" if item.stocks else item.title
        report = self._push.send(Alert(title=title, body=item.summary, item_id=item.id))
        logger.info(
            "alert sent",
            extra={
                "item_id": item.id,
                "rule": "stock" if item.stocks else "importance",
                "delivered": report.delivered,
                "removed": report.removed,
                "failed": report.failed,
            },
        )
