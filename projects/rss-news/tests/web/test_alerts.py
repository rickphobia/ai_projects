"""Alert set-up over the API: turning Alerts on and off for a phone, the test Alert through the
fake PushSender, gone subscriptions, and a server without a VAPID key."""

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.config import load_settings
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.wiring import Wiring
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    FakePushSender,
    app_env,
    make_wiring,
)
from tests.web.test_inbox import hours_ago, rss

PUSH = f"{PREFIX}/api/push"
FEED = "https://news.example/rss"
PHONE = "https://fcm.googleapis.com/fcm/send/phone-token"
TABLET = "https://fcm.googleapis.com/fcm/send/tablet-token"
# The quiet hours and daily cap the set-up shows when config doesn't change them.
DEFAULT_LIMITS = {"quiet_hours": {"start": "23:00", "end": "07:00"}, "daily_cap": 10}


def subscription(endpoint: str = PHONE, p256dh: str = "BPhoneKey") -> dict[str, Any]:
    """What the browser's PushSubscription.toJSON() sends."""
    return {"endpoint": endpoint, "expirationTime": None, "keys": {"p256dh": p256dh, "auth": "a"}}


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def sender() -> FakePushSender:
    return FakePushSender()


@pytest.fixture
def fetcher(clock: FakeClock) -> FakeFeedFetcher:
    fetcher = FakeFeedFetcher()
    fetcher.answers[FEED] = rss(
        ("Older news", "https://news.example/older", hours_ago(clock, 3)),
        ("Newest news", "https://news.example/newest", hours_ago(clock, 1)),
    )
    return fetcher


def signed_in(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


@pytest.fixture
def wiring(
    tmp_path: Path, clock: FakeClock, fetcher: FakeFeedFetcher, sender: FakePushSender
) -> Wiring:
    return make_wiring(
        load_settings(app_env(tmp_path)),
        clock,
        feed_fetcher=fetcher,
        push_sender=sender,
        starter_folders=(StarterFolder("News", (StarterSource("News", FEED),)),),
    )


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    return signed_in(wiring)


def test_the_setup_gives_the_key_a_browser_subscribes_with(client: TestClient) -> None:
    assert client.get(PUSH).json() == {
        "available": True,
        "public_key": FakePushSender.application_server_key,
        "subscriptions": 0,
        **DEFAULT_LIMITS,
    }


def test_turning_alerts_on_twice_from_one_phone_keeps_one_subscription(
    client: TestClient,
) -> None:
    assert client.post(f"{PUSH}/subscriptions", json=subscription()).status_code == 204
    # The browser hands out new keys for the same endpoint after a reinstall.
    assert (
        client.post(f"{PUSH}/subscriptions", json=subscription(p256dh="BNewKey")).status_code == 204
    )

    assert client.get(PUSH).json()["subscriptions"] == 1


def test_a_subscription_without_an_https_endpoint_is_refused(client: TestClient) -> None:
    response = client.post(
        f"{PUSH}/subscriptions", json=subscription("http://push.example/plain-http")
    )

    assert response.status_code == 422
    assert "https" in response.json()["detail"]
    assert client.get(PUSH).json()["subscriptions"] == 0


def test_turning_alerts_off_forgets_the_phone(client: TestClient) -> None:
    client.post(f"{PUSH}/subscriptions", json=subscription())

    assert client.post(f"{PUSH}/unsubscribe", json={"endpoint": PHONE}).status_code == 204
    # Turning off a phone that is already off is fine.
    assert client.post(f"{PUSH}/unsubscribe", json={"endpoint": PHONE}).status_code == 204
    assert client.get(PUSH).json()["subscriptions"] == 0


def test_the_test_alert_reaches_every_phone_and_opens_the_newest_item(
    wiring: Wiring, client: TestClient, sender: FakePushSender
) -> None:
    wiring.tick.run()
    client.post(f"{PUSH}/subscriptions", json=subscription(PHONE, "BPhoneKey"))
    client.post(f"{PUSH}/subscriptions", json=subscription(TABLET, "BTabletKey"))
    newest = client.get(f"{PREFIX}/api/inbox").json()["items"][0]

    response = client.post(f"{PUSH}/test")

    assert response.status_code == 200
    assert response.json() == {"delivered": 2, "removed": 0, "failed": 0}
    assert [(sent.endpoint, sent.p256dh) for sent, _ in sender.delivered] == [
        (PHONE, "BPhoneKey"),
        (TABLET, "BTabletKey"),
    ]
    alert = sender.delivered[0][1]
    assert alert.item_id == newest["id"]
    assert "Newest news" in alert.body


def test_the_test_alert_opens_the_app_when_there_are_no_items_yet(
    tmp_path: Path, clock: FakeClock, sender: FakePushSender
) -> None:
    client = signed_in(make_wiring(load_settings(app_env(tmp_path)), clock, push_sender=sender))
    client.post(f"{PUSH}/subscriptions", json=subscription())

    assert client.post(f"{PUSH}/test").json()["delivered"] == 1
    assert sender.delivered[0][1].item_id is None


def test_gone_subscriptions_are_removed_and_unreachable_ones_kept(
    client: TestClient, sender: FakePushSender
) -> None:
    gone = "https://fcm.googleapis.com/fcm/send/uninstalled"
    client.post(f"{PUSH}/subscriptions", json=subscription(PHONE))
    client.post(f"{PUSH}/subscriptions", json=subscription(gone))
    client.post(f"{PUSH}/subscriptions", json=subscription(TABLET))
    sender.gone.add(gone)
    sender.failing.add(TABLET)

    assert client.post(f"{PUSH}/test").json() == {"delivered": 1, "removed": 1, "failed": 1}
    assert client.get(PUSH).json()["subscriptions"] == 2

    sender.failing.clear()
    assert client.post(f"{PUSH}/test").json() == {"delivered": 2, "removed": 0, "failed": 0}


def test_the_test_alert_needs_a_phone_with_alerts_on(client: TestClient) -> None:
    response = client.post(f"{PUSH}/test")

    assert response.status_code == 409
    assert response.json()["detail"] == "Turn Alerts on for this phone first."


def test_without_a_vapid_key_alerts_say_they_are_not_set_up(
    tmp_path: Path, clock: FakeClock
) -> None:
    client = signed_in(make_wiring(load_settings(app_env(tmp_path)), clock, alerts_off=True))

    assert client.get(PUSH).json() == {
        "available": False,
        "public_key": None,
        "subscriptions": 0,
        **DEFAULT_LIMITS,
    }
    for path, body in (("/subscriptions", subscription()), ("/test", None)):
        response = client.post(f"{PUSH}{path}", json=body)
        assert response.status_code == 409
        assert "RSS_NEWS_VAPID_PRIVATE_KEY" in response.json()["detail"]


def test_alert_setup_needs_a_session(wiring: Wiring) -> None:
    client = TestClient(wiring.app)

    assert client.get(PUSH).status_code == 401
    assert client.post(f"{PUSH}/subscriptions", json=subscription()).status_code == 401
    assert client.post(f"{PUSH}/test").status_code == 401
