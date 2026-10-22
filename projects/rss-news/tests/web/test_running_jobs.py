"""Briefings and Chat answers keep running when the page that asked goes away: they are saved,
can be followed again by their job id, a second Brief me joins the running one, and a finished
or failed Briefing sends an Alert that opens it."""

import json
import threading
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.alerts.push import Alert
from rss_news.chat.conversation import ModelAnswer
from rss_news.config import load_settings
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.wiring import Wiring
from tests.support import (
    GATE_WAIT,
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    FakePushSender,
    app_env,
    make_wiring,
    post_and_leave,
)
from tests.web.test_inbox import hours_ago, rss

BRIEFINGS = f"{PREFIX}/api/briefings"
CHATS = f"{PREFIX}/api/chats"
JOBS = f"{PREFIX}/api/jobs"
AI_FEED = "https://ai.example/rss"
STARTER = (StarterFolder("AI", (StarterSource("AI News", AI_FEED),)),)
PHONE = "https://fcm.googleapis.com/fcm/send/phone-token"


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def model() -> FakeLanguageModel:
    model = FakeLanguageModel()
    model.gate = threading.Event()
    return model


@pytest.fixture
def sender() -> FakePushSender:
    return FakePushSender()


@pytest.fixture
def wiring(
    tmp_path: Path, clock: FakeClock, model: FakeLanguageModel, sender: FakePushSender
) -> Wiring:
    fetcher = FakeFeedFetcher()
    fetcher.answers[AI_FEED] = rss(
        ("New model released", "https://ai.example/model", hours_ago(clock, 2)),
    )
    wiring = make_wiring(
        load_settings(app_env(tmp_path)),
        clock,
        feed_fetcher=fetcher,
        language_model=model,
        push_sender=sender,
        starter_folders=STARTER,
    )
    wiring.tick.run()
    return wiring


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    subscription = {"endpoint": PHONE, "keys": {"p256dh": "BPhoneKey", "auth": "a"}}
    assert client.post(f"{PREFIX}/api/push/subscriptions", json=subscription).status_code == 204
    return client


def cookie(client: TestClient) -> str:
    return "; ".join(f"{name}={value}" for name, value in client.cookies.items())


def leave_briefing(wiring: Wiring, client: TestClient) -> str:
    """Press Brief me and close the page while the model is still writing; the job's id."""
    started = post_and_leave(wiring.app, BRIEFINGS, {}, cookie(client))
    return str(started["id"])


def finish(wiring: Wiring, model: FakeLanguageModel, job_id: str) -> None:
    assert model.gate is not None
    model.gate.set()
    job = wiring.jobs.get(job_id)
    assert job is not None
    assert job.wait_finished(GATE_WAIT.total_seconds())


def events(text: str) -> list[tuple[str, dict[str, Any]]]:
    parsed = []
    for block in text.strip().split("\n\n"):
        name_line, data_line = block.split("\n")
        parsed.append(
            (name_line.removeprefix("event: "), json.loads(data_line.removeprefix("data: ")))
        )
    return parsed


def alerts(sender: FakePushSender) -> list[Alert]:
    return [alert for _, alert in sender.delivered]


def test_a_briefing_is_written_and_saved_after_the_page_is_closed(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel
) -> None:
    job_id = leave_briefing(wiring, client)
    assert client.get(f"{BRIEFINGS}/latest").json() == {"briefing": None}

    finish(wiring, model, job_id)

    latest = client.get(f"{BRIEFINGS}/latest").json()["briefing"]
    assert latest["scope"] == "all-24h"
    assert [point["text"] for point in latest["sections"][0]["points"]] == [
        "Point about New model released"
    ]


def test_a_finished_briefing_can_be_followed_again_by_its_job(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel
) -> None:
    job_id = leave_briefing(wiring, client)
    finish(wiring, model, job_id)

    response = client.get(f"{JOBS}/{job_id}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    streamed = events(response.text)
    assert [name for name, _ in streamed] == ["job", "progress", "progress", "briefing"]
    assert streamed[0][1] == {"id": job_id}
    assert streamed[-1][1]["briefing"] == client.get(f"{BRIEFINGS}/latest").json()["briefing"]


def test_a_job_the_server_doesnt_know_is_lost(client: TestClient) -> None:
    response = client.get(f"{JOBS}/0123456789abcdef01234567")

    assert response.status_code == 404
    assert "server restarted" in response.json()["detail"]


def test_jobs_need_a_session(wiring: Wiring) -> None:
    assert TestClient(wiring.app).get(f"{JOBS}/0123456789abcdef01234567").status_code == 401


def test_pressing_brief_me_again_joins_the_briefing_being_written(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel
) -> None:
    first = leave_briefing(wiring, client)
    second = leave_briefing(wiring, client)

    finish(wiring, model, first)

    assert second == first
    assert len(model.sections) == 1
    assert len(client.get(BRIEFINGS).json()["briefings"]) == 1


def test_a_finished_briefing_sends_an_alert_that_opens_it(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel, sender: FakePushSender
) -> None:
    job_id = leave_briefing(wiring, client)
    assert alerts(sender) == []

    finish(wiring, model, job_id)

    briefing = client.get(f"{BRIEFINGS}/latest").json()["briefing"]
    assert alerts(sender) == [
        Alert(
            title="Your Briefing is ready",
            body="All Sources, last 24 hours. Tap to read it.",
            item_id=None,
            briefing_id=briefing["id"],
        )
    ]


def test_a_failed_briefing_sends_an_alert_saying_so(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel, sender: FakePushSender
) -> None:
    model.failing_folders = {"AI"}
    job_id = leave_briefing(wiring, client)

    finish(wiring, model, job_id)

    assert alerts(sender) == [
        Alert(
            title="Your Briefing couldn't be written",
            body="The Briefing couldn't be written, and nothing was saved: scripted refusal.",
            item_id=None,
        )
    ]


def test_a_reused_briefing_sends_no_alert(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel, sender: FakePushSender
) -> None:
    finish(wiring, model, leave_briefing(wiring, client))

    client.post(BRIEFINGS, json={})

    assert len(alerts(sender)) == 1


def test_a_chat_answer_is_saved_after_the_page_is_closed(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel
) -> None:
    model.chat_script = [ModelAnswer("Nothing new about that.", [])]
    chat_id = client.post(CHATS).json()["chat"]["id"]

    started = post_and_leave(
        wiring.app, f"{CHATS}/{chat_id}/messages", {"text": "Any chip news?"}, cookie(client)
    )
    assert client.get(f"{CHATS}/{chat_id}").json()["chat"]["messages"] == []
    finish(wiring, model, str(started["id"]))

    messages = client.get(f"{CHATS}/{chat_id}").json()["chat"]["messages"]
    assert [(message["role"], message["text"]) for message in messages] == [
        ("owner", "Any chip news?"),
        ("assistant", "Nothing new about that."),
    ]


def test_a_second_question_waits_for_the_first_answer(
    wiring: Wiring, client: TestClient, model: FakeLanguageModel
) -> None:
    model.chat_script = [ModelAnswer("First answer.", [])]
    chat_id = client.post(CHATS).json()["chat"]["id"]
    started = post_and_leave(
        wiring.app, f"{CHATS}/{chat_id}/messages", {"text": "First?"}, cookie(client)
    )

    response = client.post(f"{CHATS}/{chat_id}/messages", json={"text": "Second?"})

    assert response.status_code == 409
    assert response.json()["detail"] == "This Chat is still answering your last question."
    finish(wiring, model, str(started["id"]))
