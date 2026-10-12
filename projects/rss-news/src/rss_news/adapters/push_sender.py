"""The PushSender port: an encrypted Web Push message signed with the VAPID key, sent with
pywebpush."""

import json
import logging
import time
from datetime import timedelta

import requests
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush

from rss_news.alerts.push import Alert, Delivery, PushFailed, PushSubscription
from rss_news.alerts.vapid_keys import VapidKey

logger = logging.getLogger(__name__)

# An Alert is news: if the phone can't be reached for this long, it's stale and the push
# service may drop it.
ALERT_TIME_TO_LIVE = timedelta(hours=6)
# Push services answer within a second or two; a hung one mustn't hold up the caller.
SEND_TIMEOUT = timedelta(seconds=10)
# The push service answers these when the subscription no longer exists.
_GONE_STATUSES = (404, 410)


class WebPushSender:
    def __init__(
        self,
        *,
        vapid_key: VapidKey,
        subject: str,
        session: requests.Session | None = None,
    ) -> None:
        # `session` lets tests answer without a network.
        self._vapid = Vapid02.from_raw(vapid_key.private_key.encode())
        self._public_key = vapid_key.public_key
        self._subject = subject
        self._session = session or requests.Session()

    @property
    def application_server_key(self) -> str:
        return self._public_key

    def send(self, subscription: PushSubscription, alert: Alert) -> Delivery:
        started = time.monotonic()
        result = Delivery.DELIVERED.value
        try:
            delivery = self._send(subscription, alert)
            result = delivery.value
            return delivery
        except PushFailed as error:
            result = str(error)
            raise
        except Exception as error:
            # A bug or a refused signature, not the push service: name it so the log doesn't
            # claim the message was delivered.
            result = f"unexpected error: {type(error).__name__}"
            raise
        finally:
            logger.info(
                "push message",
                extra={
                    "port": "PushSender",
                    "host": subscription.push_host,
                    "result": result,
                    "duration_ms": round((time.monotonic() - started) * 1000),
                },
            )

    def close(self) -> None:
        self._session.close()

    def _send(self, subscription: PushSubscription, alert: Alert) -> Delivery:
        payload = {"title": alert.title, "body": alert.body, "item_id": alert.item_id}
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=json.dumps(payload),
                vapid_private_key=self._vapid,
                # A new dict each time: webpush fills in the audience and expiry in place.
                vapid_claims={"sub": self._subject},
                timeout=SEND_TIMEOUT.total_seconds(),
                ttl=int(ALERT_TIME_TO_LIVE.total_seconds()),
                # High urgency asks Android to wake the phone from Doze to show it now.
                headers={"Urgency": "high"},
                requests_session=self._session,
            )
        except WebPushException as error:
            status = error.response.status_code if error.response is not None else None
            if status in _GONE_STATUSES:
                return Delivery.GONE
            raise PushFailed(f"the push service answered HTTP {status}") from error
        except requests.RequestException as error:
            raise PushFailed(f"the push service couldn't be reached: {type(error).__name__}") from (
                error
            )
        return Delivery.DELIVERED
