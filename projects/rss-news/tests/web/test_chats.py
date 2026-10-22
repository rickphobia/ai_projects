"""Chat: searching the owner's Items with the window the question names (24 hours by default,
at most 90 days), checking the Item ids in answers, remembering earlier turns, saving and
listing Chats, the spending limit, and when web search is offered."""

import json
import sqlite3
from dataclasses import replace
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rss_news.chat.conversation import (
    AnswerEntry,
    ChatFailed,
    ItemSearch,
    ModelAnswer,
    OwnerQuestion,
    SearchResults,
)
from rss_news.config import load_settings
from rss_news.sources.catalog import StarterFolder, StarterSource
from rss_news.spending.ledger import AiUsage, Feature
from rss_news.wiring import Wiring
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeFeedFetcher,
    FakeLanguageModel,
    app_env,
    make_wiring,
)
from tests.web.test_inbox import hours_ago, rss

CHATS = f"{PREFIX}/api/chats"
AI_FEED = "https://ai.example/rss"
MALAYSIA_FEED = "https://my.example/rss"
STARTER = (
    StarterFolder("AI", (StarterSource("AI News", AI_FEED),)),
    StarterFolder("Malaysia", (StarterSource("The Star", MALAYSIA_FEED),)),
)
EVERYTHING = ItemSearch(folder=None, since=None, keyword=None, min_importance=None)


@pytest.fixture
def clock() -> FakeClock:
    # 2026-10-12 20:00 in Kuala Lumpur, a Monday.
    return FakeClock()


@pytest.fixture
def model() -> FakeLanguageModel:
    return FakeLanguageModel()


@pytest.fixture
def wiring(tmp_path: Path, clock: FakeClock, model: FakeLanguageModel) -> Wiring:
    fetcher = FakeFeedFetcher()
    fetcher.answers[AI_FEED] = rss(
        ("New model released", "https://ai.example/model", hours_ago(clock, 2)),
        ("Chip export rules", "https://ai.example/chips", hours_ago(clock, 5)),
        ("Last week's benchmark", "https://ai.example/old", hours_ago(clock, 30)),
    )
    fetcher.answers[MALAYSIA_FEED] = rss(
        ("Ringgit firms", "https://my.example/ringgit", hours_ago(clock, 1)),
        ("Budget 2026 tabled", "https://my.example/budget", hours_ago(clock, 24 * 100)),
    )
    wiring = make_wiring(
        load_settings(app_env(tmp_path, RSS_NEWS_MONTHLY_LIMIT_USD="10")),
        clock,
        feed_fetcher=fetcher,
        language_model=model,
        starter_folders=STARTER,
    )
    wiring.tick.run()
    return wiring


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


def item_ids(client: TestClient) -> dict[str, int]:
    items = client.get(f"{PREFIX}/api/inbox").json()["items"]
    return {item["title"]: item["id"] for item in items}


def new_chat(client: TestClient) -> int:
    response = client.post(CHATS)
    assert response.status_code == 201
    return int(response.json()["chat"]["id"])


def ask(client: TestClient, chat_id: int, text: str) -> list[tuple[str, dict[str, Any]]]:
    response = client.post(f"{CHATS}/{chat_id}/messages", json={"text": text})
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    parsed = []
    for block in response.text.strip().split("\n\n"):
        name_line, data_line = block.split("\n")
        parsed.append(
            (name_line.removeprefix("event: "), json.loads(data_line.removeprefix("data: ")))
        )
    # First the id the answer can be followed again by; test_running_jobs.py covers it.
    assert parsed[0][0] == "job", parsed
    return parsed[1:]


def searched_with(model: FakeLanguageModel, call: int = 1) -> SearchResults:
    """What the model was given back after its searches, on its `call`th call (0-based)."""
    given = model.chat_calls[call][1]
    assert isinstance(given, SearchResults)
    return given


def answer(intro: str, *ids: int) -> ModelAnswer:
    return ModelAnswer(intro, [AnswerEntry(item_id, f"About {item_id}") for item_id in ids])


def test_chats_need_a_session(wiring: Wiring) -> None:
    client = TestClient(wiring.app)

    assert client.get(CHATS).status_code == 401
    assert client.post(CHATS).status_code == 401
    assert client.post(f"{CHATS}/1/messages", json={"text": "hi"}).status_code == 401


def test_a_question_without_a_window_searches_the_last_24_hours(
    client: TestClient, model: FakeLanguageModel
) -> None:
    ids = item_ids(client)
    model.chat_script = [
        [EVERYTHING],
        answer("In the last 24 hours, 3 Items:", ids["Ringgit firms"]),
    ]

    events = ask(client, new_chat(client), "what happened today?")

    assert events[0] == ("searched", {"window": "the last 24 hours", "count": 3})
    ((_, result),) = searched_with(model).results
    assert [item.title for item in result.items] == [
        "Ringgit firms",
        "New model released",
        "Chip export rules",
    ]
    name, message = events[-1]
    assert name == "message"
    assert message["role"] == "assistant"
    assert message["text"] == "In the last 24 hours, 3 Items:"
    # Importance and time are covered by test_answer_items_carry_their_importance_and_time.
    assert [
        {key: item[key] for key in ("id", "title", "source", "summary")}
        for item in message["items"]
    ] == [
        {
            "id": ids["Ringgit firms"],
            "title": "Ringgit firms",
            "source": "The Star",
            "summary": f"About {ids['Ringgit firms']}",
        }
    ]


def test_the_question_carries_the_local_time_and_the_folders(
    client: TestClient, model: FakeLanguageModel
) -> None:
    model.chat_script = [answer("Nothing to search for.")]

    ask(client, new_chat(client), "hello")

    ((context, given),) = model.chat_calls
    assert context == ""
    assert isinstance(given, OwnerQuestion)
    assert given.text == "hello"
    assert given.asked_at.isoformat() == "2026-10-12T20:00:00+08:00"
    assert given.folder_names == ["AI", "Malaysia"]


def test_a_named_window_reaches_back_to_its_start(
    client: TestClient, model: FakeLanguageModel
) -> None:
    since_friday = ItemSearch(folder=None, since="2026-10-09", keyword=None, min_importance=None)
    model.chat_script = [[since_friday], answer("Since Friday:")]

    events = ask(client, new_chat(client), "what happened since Friday?")

    assert events[0] == ("searched", {"window": "since 2026-10-09 00:00", "count": 4})


def test_a_window_goes_back_at_most_90_days(client: TestClient, model: FakeLanguageModel) -> None:
    this_year = ItemSearch(folder=None, since="2026-01-01", keyword=None, min_importance=None)
    model.chat_script = [[this_year], answer("This year:")]

    events = ask(client, new_chat(client), "everything this year")

    # The 100-day-old Budget Item is left out.
    assert events[0] == ("searched", {"window": "since 2026-07-14 20:00", "count": 4})


def test_a_search_filters_by_folder_keyword_and_importance(
    client: TestClient, model: FakeLanguageModel
) -> None:
    model.chat_script = [
        [
            ItemSearch(folder="ai", since=None, keyword="chip", min_importance=None),
            ItemSearch(folder="Malaysia", since=None, keyword=None, min_importance=4),
        ],
        answer("Chips:"),
    ]

    events = ask(client, new_chat(client), "chips?")

    assert [event for event in events if event[0] == "searched"] == [
        ("searched", {"window": "the last 24 hours", "count": 1}),
        ("searched", {"window": "the last 24 hours", "count": 0}),
    ]
    first, second = searched_with(model).results
    assert first[0] == "call-0"
    assert [item.title for item in first[1].items] == ["Chip export rules"]
    assert second[1].items == []


@pytest.mark.parametrize(
    ("search", "error"),
    [
        (ItemSearch("Sports", None, None, None), "There is no Folder 'Sports'."),
        (ItemSearch(None, "last week", None, None), "isn't an ISO 8601 date or time"),
        (ItemSearch(None, "2026-10-20", None, None), "since is in the future."),
        (ItemSearch(None, None, None, 9), "min_importance must be from 1 to 5."),
    ],
)
def test_a_search_that_cant_run_tells_the_model_why(
    client: TestClient, model: FakeLanguageModel, search: ItemSearch, error: str
) -> None:
    model.chat_script = [[search], answer("Sorry.")]

    events = ask(client, new_chat(client), "?")

    assert [name for name, _ in events] == ["message"]
    ((_, result),) = searched_with(model).results
    assert result.error is not None
    assert error in result.error


def test_answer_items_that_dont_exist_are_dropped(
    client: TestClient, model: FakeLanguageModel
) -> None:
    ids = item_ids(client)
    real = ids["Chip export rules"]
    model.chat_script = [[EVERYTHING], answer("Two:", 99_999, real, real)]

    events = ask(client, new_chat(client), "chips?")

    assert [item["id"] for item in events[-1][1]["items"]] == [real]


def test_follow_ups_remember_the_conversation_and_chats_are_saved_and_listed(
    client: TestClient, model: FakeLanguageModel, clock: FakeClock
) -> None:
    ids = item_ids(client)
    chat_id = new_chat(client)
    empty_id = new_chat(client)
    clock.advance(timedelta(minutes=1))
    model.chat_script = [[EVERYTHING], answer("Three Items:", ids["Ringgit firms"])]
    ask(client, chat_id, "what happened in   Malaysia?")
    model.chat_script = [answer("It firmed against the dollar.")]
    ask(client, chat_id, "tell me more about the ringgit")

    # The second turn continues from the context the first one ended with.
    assert model.chat_calls[2][0] == "[1][2]"
    chat = client.get(f"{CHATS}/{chat_id}").json()["chat"]
    assert chat["title"] == "what happened in Malaysia?"
    assert [(message["role"], message["text"]) for message in chat["messages"]] == [
        ("owner", "what happened in   Malaysia?"),
        ("assistant", "Three Items:"),
        ("owner", "tell me more about the ringgit"),
        ("assistant", "It firmed against the dollar."),
    ]
    assert chat["messages"][1]["items"][0]["title"] == "Ringgit firms"
    # Three calls at $0.03 each (5,000 in and 500 out at Opus prices).
    assert chat["cost_usd"] == "0.09"
    # The most recently used first: asking moved the older Chat up.
    listed = client.get(CHATS).json()["chats"]
    assert [(chat["id"], chat["title"]) for chat in listed] == [
        (chat_id, "what happened in Malaysia?"),
        (empty_id, "New Chat"),
    ]


def test_answer_items_carry_their_importance_and_time(
    client: TestClient, model: FakeLanguageModel
) -> None:
    listed = client.get(f"{PREFIX}/api/inbox").json()["items"]
    ringgit = next(item for item in listed if item["title"] == "Ringgit firms")
    chat_id = new_chat(client)
    model.chat_script = [[EVERYTHING], answer("One Item:", ringgit["id"])]

    events = ask(client, chat_id, "what happened in Malaysia?")

    expected = {
        "id": ringgit["id"],
        "title": "Ringgit firms",
        "source": ringgit["source"],
        "summary": f"About {ringgit['id']}",
        "importance": ringgit["importance"],
        "published_at": ringgit["published_at"],
    }
    answered = dict(events)["message"]
    assert answered["items"] == [expected]
    saved = client.get(f"{CHATS}/{chat_id}").json()["chat"]["messages"][1]
    assert saved["items"] == [expected]


def test_answers_saved_before_items_had_a_time_still_load(
    client: TestClient, tmp_path: Path
) -> None:
    chat_id = new_chat(client)
    old_items = '[{"id": 1, "title": "Old", "source": "The Star", "summary": "Said."}]'
    with sqlite3.connect(tmp_path / "rss-news.sqlite3") as connection:
        connection.execute(
            "INSERT INTO chat_messages (chat_id, created_at, role, text, items) "
            "VALUES (?, '2026-10-01T00:00:00+00:00', 'assistant', 'One:', ?)",
            (chat_id, old_items),
        )
    connection.close()

    saved = client.get(f"{CHATS}/{chat_id}").json()["chat"]["messages"][0]

    assert saved["items"] == [
        {
            "id": 1,
            "title": "Old",
            "source": "The Star",
            "summary": "Said.",
            "importance": None,
            "published_at": None,
        }
    ]


def test_each_model_call_goes_in_the_ledger(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    model.chat_script = [[EVERYTHING], answer("Done.")]

    ask(client, new_chat(client), "news?")

    chat_calls = [call for call in wiring.ledger.calls() if call.feature is Feature.CHAT]
    assert [call.usage for call in chat_calls] == [model.CHAT_USAGE, model.CHAT_USAGE]


def test_a_failed_call_saves_nothing_but_its_cost_is_recorded(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    refusal_usage = AiUsage("claude-opus-5-5", 4_000, 10, 0, model.CHAT_USAGE.duration)
    model.chat_script = [[EVERYTHING], ChatFailed("no answer: stop reason refusal", refusal_usage)]
    chat_id = new_chat(client)

    events = ask(client, chat_id, "news?")

    assert events[-1] == (
        "failed",
        {"detail": "The Chat couldn't answer: no answer: stop reason refusal."},
    )
    assert client.get(f"{CHATS}/{chat_id}").json()["chat"]["messages"] == []
    chat_calls = [call.usage for call in wiring.ledger.calls() if call.feature is Feature.CHAT]
    assert chat_calls == [model.CHAT_USAGE, refusal_usage]


def test_the_model_must_answer_after_four_searching_calls(
    client: TestClient, model: FakeLanguageModel
) -> None:
    model.chat_script = [[EVERYTHING], [EVERYTHING], [EVERYTHING], [EVERYTHING], answer("Enough.")]

    events = ask(client, new_chat(client), "news?")

    assert events[-1][0] == "message"
    assert [searched_with(model, call).last for call in range(1, 5)] == [
        False,
        False,
        False,
        True,
    ]


def test_a_model_that_wont_stop_searching_fails_the_turn(
    client: TestClient, model: FakeLanguageModel
) -> None:
    model.chat_script = [[EVERYTHING]] * 5

    events = ask(client, new_chat(client), "news?")

    assert events[-1] == (
        "failed",
        {"detail": "The Chat couldn't answer: the model kept searching instead of answering."},
    )


def test_chat_is_refused_at_the_spending_limit_without_calling_the_model(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    chat_id = new_chat(client)
    for _ in range(10):
        wiring.ledger.record(
            Feature.BRIEFINGS, AiUsage("claude-opus-5-5", 250_000, 0, 0, model.CHAT_USAGE.duration)
        )

    response = client.post(f"{CHATS}/{chat_id}/messages", json={"text": "news?"})

    assert response.status_code == 429
    assert (
        "Briefings, Chat, Simple summaries and Dictionary are off until next month"
        in response.json()["detail"]
    )
    assert model.chat_calls == []


def test_an_unknown_chat_is_not_found(client: TestClient) -> None:
    assert client.get(f"{CHATS}/404").status_code == 404
    assert client.post(f"{CHATS}/404/messages", json={"text": "hi"}).status_code == 404


def test_an_empty_question_is_refused(client: TestClient) -> None:
    chat_id = new_chat(client)

    assert client.post(f"{CHATS}/{chat_id}/messages", json={"text": "   "}).status_code == 422


def test_ask_ai_sends_the_selection_and_its_origin_after_the_question(
    client: TestClient, model: FakeLanguageModel
) -> None:
    model.chat_script = [answer("It means the rate held.")]
    chat_id = new_chat(client)

    response = client.post(
        f"{CHATS}/{chat_id}/messages",
        json={
            "text": "What does this mean?",
            "quote": {
                "text": "BNM kept the OPR at 2.75%.\nInflation stays moderate.",
                "origin": "Item: BNM holds rates (The Star)",
            },
        },
    )

    assert response.status_code == 200
    question = model.chat_calls[0][1]
    assert isinstance(question, OwnerQuestion)
    expected = (
        "What does this mean?\n\nAbout this, from Item: BNM holds rates (The Star):\n"
        "> BNM kept the OPR at 2.75%.\n> Inflation stays moderate."
    )
    assert question.text == expected
    chat = client.get(f"{CHATS}/{chat_id}").json()["chat"]
    assert chat["messages"][0]["text"] == expected
    # The title starts with the question, not the quote.
    assert chat["title"].startswith("What does this mean? About this")


def test_a_quote_without_an_origin_is_refused(client: TestClient) -> None:
    chat_id = new_chat(client)

    response = client.post(
        f"{CHATS}/{chat_id}/messages", json={"text": "why?", "quote": {"text": "x", "origin": ""}}
    )

    assert response.status_code == 422


def test_web_search_is_not_offered_while_the_items_answer(
    client: TestClient, model: FakeLanguageModel
) -> None:
    model.chat_script = [[EVERYTHING], answer("Three Items.")]

    ask(client, new_chat(client), "what happened today?")

    question = model.chat_calls[0][1]
    assert isinstance(question, OwnerQuestion)
    assert question.web_searches_left == 0
    assert searched_with(model).web_searches_left == 0


def test_web_search_is_offered_when_the_owner_asks_for_it(
    client: TestClient, model: FakeLanguageModel
) -> None:
    model.chat_script = [answer("From the web.")]

    ask(client, new_chat(client), "Search the web for the KLCI close")

    question = model.chat_calls[0][1]
    assert isinstance(question, OwnerQuestion)
    assert question.web_searches_left == 5


def test_web_search_is_offered_when_search_items_finds_nothing(
    client: TestClient, model: FakeLanguageModel
) -> None:
    nothing = ItemSearch(folder=None, since=None, keyword="cricket", min_importance=None)
    model.chat_script = [[nothing], answer("Nothing in your Items.")]

    ask(client, new_chat(client), "any cricket scores?")

    assert searched_with(model).web_searches_left == 5


def test_web_searches_are_capped_at_5_per_question(
    client: TestClient, model: FakeLanguageModel
) -> None:
    nothing = ItemSearch(folder=None, since=None, keyword="cricket", min_importance=None)
    model.chat_usage = replace(model.CHAT_USAGE, web_searches=3)
    model.chat_script = [[nothing], [nothing], [nothing], answer("Nothing.")]

    ask(client, new_chat(client), "search online for cricket scores")

    assert [searched_with(model, call).web_searches_left for call in (1, 2, 3)] == [2, 0, 0]


def test_an_answer_that_searched_the_web_is_flagged_and_its_searches_paid_for(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    model.chat_usage = replace(model.CHAT_USAGE, web_searches=2)
    model.chat_script = [answer("The KLCI closed higher.")]
    chat_id = new_chat(client)

    events = ask(client, chat_id, "check the web for the KLCI close")

    assert events[-1][1]["text"] == "Searched the web. The KLCI closed higher."
    (call,) = [call for call in wiring.ledger.calls() if call.feature is Feature.CHAT]
    assert call.usage.web_searches == 2
    # $0.03 for the tokens and 2 searches at $0.01.
    assert client.get(f"{CHATS}/{chat_id}").json()["chat"]["cost_usd"] == "0.05"
