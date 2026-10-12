"""Alerts over the JSON API: whether they're set up, turning them on or off for a phone, and
the test Alert."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from rss_news.alerts.push import (
    AlertPush,
    AlertsNotSetUp,
    InvalidSubscription,
    NoSubscriptions,
    PushSubscription,
)

alerts_router = APIRouter(prefix="/api/push")
# Real endpoints are a few hundred characters; this keeps junk out of the table.
_MAX_ENDPOINT_LENGTH = 2048
_MAX_KEY_LENGTH = 256


class SubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=_MAX_KEY_LENGTH)
    auth: str = Field(min_length=1, max_length=_MAX_KEY_LENGTH)


class SubscribeBody(BaseModel):
    """The browser's PushSubscription.toJSON(), sent as it is."""

    endpoint: str = Field(min_length=1, max_length=_MAX_ENDPOINT_LENGTH)
    keys: SubscriptionKeys


class UnsubscribeBody(BaseModel):
    endpoint: str = Field(min_length=1, max_length=_MAX_ENDPOINT_LENGTH)


def push_of(request: Request) -> AlertPush:
    push: AlertPush = request.app.state.alert_push
    return push


@alerts_router.get("")
def push_setup(request: Request) -> dict[str, Any]:
    """Whether the server can send Alerts, the key a browser subscribes with, and how many
    phones have them on."""
    push = push_of(request)
    key = push.application_server_key
    return {
        "available": key is not None,
        "public_key": key,
        "subscriptions": push.subscription_count(),
    }


@alerts_router.post("/subscriptions", status_code=204)
def subscribe(request: Request, body: SubscribeBody) -> Response:
    try:
        push_of(request).subscribe(
            PushSubscription(body.endpoint, body.keys.p256dh, body.keys.auth)
        )
    except AlertsNotSetUp as error:
        raise HTTPException(status_code=409, detail=str(error)) from None
    except InvalidSubscription as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    return Response(status_code=204)


@alerts_router.post("/unsubscribe", status_code=204)
def unsubscribe(request: Request, body: UnsubscribeBody) -> Response:
    push_of(request).unsubscribe(body.endpoint)
    return Response(status_code=204)


@alerts_router.post("/test")
def send_test_alert(request: Request) -> dict[str, int]:
    """A test Alert to every phone with Alerts on: how many got it, how many subscriptions were
    gone and removed, and how many couldn't be reached this time."""
    try:
        report = push_of(request).send_test()
    except (AlertsNotSetUp, NoSubscriptions) as error:
        raise HTTPException(status_code=409, detail=str(error)) from None
    return {"delivered": report.delivered, "removed": report.removed, "failed": report.failed}
