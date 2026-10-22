"""Push subscriptions and sending Alerts to them: turning Alerts on or off for a phone, and the
test Alert that proves they arrive."""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Protocol
from urllib.parse import urlsplit

from rss_news.clock import Clock
from rss_news.items.inbox import Inbox

logger = logging.getLogger(__name__)

TEST_ALERT_TITLE = "rss-news test Alert"


class AlertsNotSetUp(Exception):
    """The server has no VAPID key, so it can't send Alerts."""


class InvalidSubscription(Exception):
    """A push subscription the browser couldn't have made, such as one without an https URL."""


class NoSubscriptions(Exception):
    """No phone has Alerts turned on, so there is nobody to send to."""


class PushFailed(Exception):
    """The push service refused the message or couldn't be reached. The subscription may still
    be good, so it is kept."""


class Delivery(StrEnum):
    DELIVERED = "delivered"
    # The push service says the subscription no longer exists, such as after the app was
    # uninstalled or its notification permission was taken away.
    GONE = "gone"


@dataclass(frozen=True)
class PushSubscription:
    """Where one browser receives push messages, as its PushSubscription gives it."""

    # The push service URL for this browser. Anyone holding it can message the phone, so it is
    # kept out of logs.
    endpoint: str = field(repr=False)
    # The browser's keys for encrypting messages to it, base64url.
    p256dh: str = field(repr=False)
    auth: str = field(repr=False)

    @property
    def push_host(self) -> str:
        """The push service's host, the part of the endpoint that is safe to log."""
        return urlsplit(self.endpoint).hostname or "unknown"


@dataclass(frozen=True)
class Alert:
    title: str
    body: str
    # The Item that tapping the Alert opens; None opens the app.
    item_id: int | None
    # The Briefing that tapping it opens instead, for a Briefing written while the page was
    # closed.
    briefing_id: int | None = None


@dataclass(frozen=True)
class SendReport:
    delivered: int
    # Gone subscriptions, which are deleted.
    removed: int
    # Kept subscriptions that couldn't be sent to this time.
    failed: int


class PushSender(Protocol):
    @property
    def application_server_key(self) -> str:
        """The public key a browser subscribes with, base64url."""
        ...

    def send(self, subscription: PushSubscription, alert: Alert) -> Delivery:
        """Send one Alert; raises PushFailed when it wasn't delivered and the subscription isn't
        known to be gone."""
        ...


class SubscriptionStore(Protocol):
    def save(self, subscription: PushSubscription, at: datetime) -> None:
        """Store it, replacing the keys of a stored one with the same endpoint."""
        ...

    def remove(self, endpoint: str) -> None: ...

    def all(self) -> list[PushSubscription]: ...


class AlertPush:
    """Alerts over push: storing subscriptions and sending to every one of them.

    Without a sender the server has no VAPID key: storing and sending refuse with AlertsNotSetUp.
    """

    def __init__(
        self,
        *,
        store: SubscriptionStore,
        sender: PushSender | None,
        inbox: Inbox,
        clock: Clock,
    ) -> None:
        self._store = store
        self._sender = sender
        self._inbox = inbox
        self._clock = clock

    @property
    def application_server_key(self) -> str | None:
        """None when Alerts aren't set up."""
        return self._sender.application_server_key if self._sender else None

    def subscription_count(self) -> int:
        return len(self._store.all())

    def subscribe(self, subscription: PushSubscription) -> None:
        self._require_sender()
        parts = urlsplit(subscription.endpoint)
        if parts.scheme != "https" or not parts.hostname:
            raise InvalidSubscription("A push subscription's endpoint must be an https URL.")
        if not subscription.p256dh or not subscription.auth:
            raise InvalidSubscription("A push subscription needs its p256dh and auth keys.")
        self._store.save(subscription, self._clock.now())
        logger.info("alerts turned on for a phone", extra={"host": subscription.push_host})

    def unsubscribe(self, endpoint: str) -> None:
        """Forget the subscription; one that isn't stored is already off."""
        self._store.remove(endpoint)
        logger.info("alerts turned off for a phone", extra={"host": urlsplit(endpoint).hostname})

    def send(self, alert: Alert) -> SendReport:
        """Send the Alert to every subscription, deleting the gone ones."""
        sender = self._require_sender()
        delivered = removed = failed = 0
        for subscription in self._store.all():
            try:
                delivery = sender.send(subscription, alert)
            except PushFailed as error:
                failed += 1
                logger.warning(
                    "alert not delivered",
                    extra={"host": subscription.push_host, "error": str(error)},
                )
                continue
            if delivery is Delivery.GONE:
                self._store.remove(subscription.endpoint)
                removed += 1
                logger.info(
                    "gone push subscription removed", extra={"host": subscription.push_host}
                )
            else:
                delivered += 1
        return SendReport(delivered=delivered, removed=removed, failed=failed)

    def send_if_on(self, alert: Alert) -> SendReport | None:
        """Send the Alert if the server can and some phone has Alerts on; None if not. Not held
        back by quiet hours or the daily cap: the owner asked for what it reports."""
        if self._sender is None or not self._store.all():
            logger.info("alert not sent: alerts are off", extra={"title": alert.title})
            return None
        report = self.send(alert)
        logger.info(
            "alert sent",
            extra={
                "title": alert.title,
                "delivered": report.delivered,
                "removed": report.removed,
                "failed": report.failed,
            },
        )
        return report

    def send_test(self) -> SendReport:
        """A test Alert to every phone. It opens the newest Item, so tapping it shows that
        Alerts open their Item; with no Items yet it opens the app."""
        self._require_sender()
        if not self._store.all():
            raise NoSubscriptions("Turn Alerts on for this phone first.")
        newest = self._inbox.page(limit=1).items
        alert = Alert(
            title=TEST_ALERT_TITLE,
            body=f"Alerts work. Tap to open: {newest[0].title}" if newest else "Alerts work.",
            item_id=newest[0].id if newest else None,
        )
        report = self.send(alert)
        logger.info(
            "test alert sent",
            extra={
                "delivered": report.delivered,
                "removed": report.removed,
                "failed": report.failed,
            },
        )
        return report

    def _require_sender(self) -> PushSender:
        if self._sender is None:
            raise AlertsNotSetUp(
                "Alerts aren't set up on the server: RSS_NEWS_VAPID_PRIVATE_KEY is not set."
            )
        return self._sender
