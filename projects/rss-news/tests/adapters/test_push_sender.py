"""The Web Push adapter against a stand-in push service: what it sends, and how each answer
becomes delivered, gone or failed."""

import base64
import json
from typing import Any

import http_ece
import pytest
import requests
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from rss_news.adapters.push_sender import WebPushSender
from rss_news.alerts.push import Alert, Delivery, PushFailed, PushSubscription
from rss_news.alerts.vapid_keys import generate_vapid_private_key, parse_vapid_private_key

ENDPOINT = "https://fcm.googleapis.com/fcm/send/phone-token"
ALERT = Alert(title="Fed holds rates", body="Summary", item_id=42)


class FakePushService(requests.Session):
    """Answers every POST with `status`, or raises `error`, and records the request."""

    def __init__(self, status: int = 201, error: Exception | None = None) -> None:
        super().__init__()
        self.status = status
        self.error = error
        self.posts: list[tuple[str, dict[str, Any]]] = []

    def post(self, url: str | bytes, data: Any = None, json: Any = None, **kwargs: Any) -> Any:
        self.posts.append((str(url), {"data": data, **kwargs}))
        if self.error:
            raise self.error
        response = requests.Response()
        response.status_code = self.status
        response._content = b""
        return response


# The browser's side of a subscription: its key pair and auth secret, so a test can read what
# the adapter encrypted to it.
BROWSER_KEY = ec.generate_private_key(ec.SECP256R1())
AUTH_SECRET = b"sixteen-byte-sec"


def browser_subscription() -> PushSubscription:
    point = BROWSER_KEY.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return PushSubscription(ENDPOINT, p256dh=b64url(point), auth=b64url(AUTH_SECRET))


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def sender(service: FakePushService) -> WebPushSender:
    return WebPushSender(
        vapid_key=parse_vapid_private_key(generate_vapid_private_key()),
        subject="mailto:owner@example.com",
        session=service,
    )


def test_a_delivered_message_is_signed_encrypted_and_urgent() -> None:
    service = FakePushService(201)

    assert sender(service).send(browser_subscription(), ALERT) is Delivery.DELIVERED

    [(url, request)] = service.posts
    assert url == ENDPOINT
    headers = request["headers"]
    assert headers["Authorization"].startswith("vapid t=")
    assert headers["Urgency"] == "high"
    assert headers["content-encoding"] == "aes128gcm"
    assert int(headers["ttl"]) > 0
    # Encrypted: the Item's title is not readable on the wire.
    assert b"Fed holds rates" not in request["data"]


@pytest.mark.parametrize("status", [404, 410])
def test_a_subscription_the_push_service_no_longer_knows_is_gone(status: int) -> None:
    assert sender(FakePushService(status)).send(browser_subscription(), ALERT) is Delivery.GONE


def test_a_refused_message_fails_and_says_how() -> None:
    with pytest.raises(PushFailed, match="HTTP 429"):
        sender(FakePushService(429)).send(browser_subscription(), ALERT)


def test_an_unreachable_push_service_fails() -> None:
    service = FakePushService(error=requests.ConnectionError("no route"))

    with pytest.raises(PushFailed, match="couldn't be reached"):
        sender(service).send(browser_subscription(), ALERT)


def test_the_application_server_key_is_the_configured_public_key() -> None:
    key = parse_vapid_private_key(generate_vapid_private_key())

    push = WebPushSender(vapid_key=key, subject="mailto:owner@example.com")
    try:
        assert push.application_server_key == key.public_key
    finally:
        push.close()


def test_the_phone_can_read_the_alert_and_the_item_it_opens() -> None:
    service = FakePushService(201)

    sender(service).send(browser_subscription(), ALERT)

    [(_, request)] = service.posts
    payload = http_ece.decrypt(
        request["data"], private_key=BROWSER_KEY, auth_secret=AUTH_SECRET, version="aes128gcm"
    )
    assert json.loads(payload) == {"title": "Fed holds rates", "body": "Summary", "item_id": 42}
