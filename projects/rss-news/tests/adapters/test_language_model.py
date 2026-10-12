"""The Anthropic LanguageModel against httpx2's mock transport and a saved response: no network."""

import json
import logging
from collections.abc import Callable
from datetime import timedelta
from pathlib import Path
from typing import Any

import anthropic
import httpx2
import pytest

from rss_news.adapters.language_model import AnthropicLanguageModel
from rss_news.scoring.item_scoring import (
    EXCERPT_CHARACTERS,
    ItemScore,
    ScoringFailed,
    UnscoredItem,
)

SAVED = Path(__file__).parent / "anthropic"
ITEMS = [
    UnscoredItem(101, "Fed cuts rates by 50 basis points", "The Federal Reserve...", "Reuters", 0),
    UnscoredItem(
        102,
        "BNM kekalkan OPR pada 2.75 peratus",
        "Bank Negara Malaysia mengekalkan Kadar Dasar Semalaman...",
        "Berita Harian",
        0,
    ),
    UnscoredItem(103, "My laptop running a 70B model", "x" * 5000, "r/LocalLLaMA", 0),
]

type Answer = Callable[[httpx2.Request], httpx2.Response]


def saved_response() -> dict[str, Any]:
    body: dict[str, Any] = json.loads((SAVED / "scoring-response.json").read_text())
    return body


def ok(request: httpx2.Request) -> httpx2.Response:
    return httpx2.Response(200, json=saved_response())


def model(answer: Answer, *, max_attempts: int = 3) -> tuple[AnthropicLanguageModel, list[float]]:
    sleeps: list[float] = []
    language_model = AnthropicLanguageModel(
        api_key="sk-ant-test",
        scoring_model="claude-haiku-5-5",
        timeout=timedelta(seconds=5),
        max_attempts=max_attempts,
        http_client=anthropic.DefaultHttpxClient(transport=httpx2.MockTransport(answer)),
        sleep=sleeps.append,
    )
    return language_model, sleeps


def test_a_saved_scoring_answer_gives_scores_and_usage() -> None:
    language_model, _ = model(ok)

    result = language_model.score_items(ITEMS)

    assert result.scores == [
        ItemScore(
            101,
            5,
            "The US Federal Reserve cut interest rates by half a point, more than markets "
            "expected.",
        ),
        ItemScore(
            102,
            3,
            "Bank Negara Malaysia kept the overnight policy rate at 2.75% and said inflation "
            "stays moderate.",
        ),
        ItemScore(
            103,
            1,
            "A user shares a meme about local language models running slowly on old laptops.",
        ),
    ]
    assert result.usage.model == "claude-haiku-5-5"
    assert (result.usage.input_tokens, result.usage.output_tokens) == (1180, 143)
    assert result.usage.web_searches == 0


def test_the_request_asks_the_scoring_model_for_english_scores_as_json() -> None:
    seen: list[dict[str, Any]] = []

    def answer(request: httpx2.Request) -> httpx2.Response:
        seen.append(json.loads(request.content))
        return ok(request)

    language_model, _ = model(answer)
    language_model.score_items(ITEMS)

    (body,) = seen
    assert body["model"] == "claude-haiku-5-5"
    assert body["output_config"]["effort"] == "low"
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert "English even when the Item is in Malay" in body["system"]
    prompt = body["messages"][0]["content"]
    listed = json.loads(prompt[prompt.index("[") :])
    assert [item["id"] for item in listed] == [101, 102, 103]
    assert listed[1]["title"] == "BNM kekalkan OPR pada 2.75 peratus"
    assert len(listed[2]["excerpt"]) == EXCERPT_CHARACTERS


def test_an_overloaded_answer_is_retried_with_backoff_and_logged(
    caplog: pytest.LogCaptureFixture,
) -> None:
    answers = iter(
        [
            httpx2.Response(529, json={"type": "error", "error": {"type": "overloaded_error"}}),
            httpx2.Response(500, json={"type": "error", "error": {"type": "api_error"}}),
        ]
    )

    def answer(request: httpx2.Request) -> httpx2.Response:
        return next(answers, None) or ok(request)

    language_model, sleeps = model(answer)
    with caplog.at_level(logging.WARNING):
        result = language_model.score_items(ITEMS)

    assert len(result.scores) == 3
    assert len(sleeps) == 2
    assert 1 <= sleeps[0] < 2 <= sleeps[1] < 3
    retries = [record for record in caplog.records if record.getMessage() == "ai call retried"]
    assert [record.__dict__["attempt"] for record in retries] == [1, 2]
    assert all(record.__dict__["model"] == "claude-haiku-5-5" for record in retries)


def test_a_rate_limit_waits_as_long_as_retry_after_says() -> None:
    answers = iter([httpx2.Response(429, headers={"retry-after": "20"}, json={})])

    def answer(request: httpx2.Request) -> httpx2.Response:
        return next(answers, None) or ok(request)

    language_model, sleeps = model(answer)
    language_model.score_items(ITEMS)

    assert sleeps == [20.0]


def test_a_network_error_is_retried() -> None:
    calls = 0

    def answer(request: httpx2.Request) -> httpx2.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise httpx2.ConnectError("connection refused")
        return ok(request)

    language_model, _ = model(answer)

    assert len(language_model.score_items(ITEMS).scores) == 3
    assert calls == 2


def test_giving_up_after_the_last_attempt_fails_without_usage() -> None:
    def answer(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(503, json={})

    language_model, sleeps = model(answer, max_attempts=3)

    with pytest.raises(ScoringFailed, match="HTTP 503") as failure:
        language_model.score_items(ITEMS)

    assert len(sleeps) == 2
    assert failure.value.usage is None


def test_a_bad_request_is_not_retried() -> None:
    calls = 0

    def answer(request: httpx2.Request) -> httpx2.Response:
        nonlocal calls
        calls += 1
        error = {"type": "invalid_request_error", "message": "model: not found"}
        return httpx2.Response(400, json={"type": "error", "error": error})

    language_model, _ = model(answer)

    with pytest.raises(ScoringFailed, match="HTTP 400"):
        language_model.score_items(ITEMS)
    assert calls == 1


def test_a_refusal_fails_but_reports_the_tokens_it_cost() -> None:
    refused = saved_response()
    refused["stop_reason"] = "refusal"
    refused["stop_details"] = {"type": "refusal", "category": "cyber", "explanation": None}
    refused["content"] = []

    language_model, _ = model(lambda request: httpx2.Response(200, json=refused))

    with pytest.raises(ScoringFailed, match=r"refusal \(cyber\)") as failure:
        language_model.score_items(ITEMS)
    assert failure.value.usage is not None
    assert failure.value.usage.input_tokens == 1180


def test_an_answer_that_is_not_the_scores_json_fails_with_its_usage() -> None:
    garbled = saved_response()
    garbled["content"] = [{"type": "text", "text": "Here are your scores!"}]

    language_model, _ = model(lambda request: httpx2.Response(200, json=garbled))

    with pytest.raises(ScoringFailed, match="not the scores JSON") as failure:
        language_model.score_items(ITEMS)
    assert failure.value.usage is not None
