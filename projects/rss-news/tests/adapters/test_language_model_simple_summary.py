"""Writing a Simple summary through the Anthropic LanguageModel, against a saved response."""

import json
from typing import Any

import httpx2
import pytest

from rss_news.simple_summaries.summarising import SimpleSummaryFailed, SimpleSummaryRequest
from tests.adapters.test_language_model import SAVED, model

REQUEST = SimpleSummaryRequest(
    "BNM keeps OPR at 2.75%", "The Star", "Bank Negara kept the OPR at 2.75% on Thursday."
)


def saved_summary() -> dict[str, Any]:
    body: dict[str, Any] = json.loads((SAVED / "simple-summary-response.json").read_text())
    return body


def with_text(text: str) -> dict[str, Any]:
    body = saved_summary()
    body["content"][1]["text"] = text
    return body


def ok(request: httpx2.Request) -> httpx2.Response:
    return httpx2.Response(200, json=saved_summary())


def test_a_saved_summary_gives_the_gist_and_tidy_points_under_the_model_asked_for() -> None:
    language_model, _ = model(ok)

    result = language_model.summarise_simply(REQUEST)

    assert result.summary.gist == "Malaysia's central bank kept its main interest rate the same."
    # Spaces are tidied and empty points dropped.
    assert result.summary.points == [
        "Bank Negara left the OPR, the rate banks pay to borrow from each other overnight, at "
        "2.75%.",
        "Keeping it steady means loan and savings rates should not change much for now.",
        "It said prices are rising slowly, so there is no rush to move.",
    ]
    assert result.usage.model == "claude-haiku-5-5"
    assert (result.usage.input_tokens, result.usage.output_tokens) == (2140, 236)


def test_the_request_asks_the_simple_summary_model_for_json_with_the_items_text() -> None:
    seen: list[dict[str, Any]] = []

    def answer(request: httpx2.Request) -> httpx2.Response:
        seen.append(json.loads(request.content))
        return ok(request)

    language_model, _ = model(answer)
    language_model.summarise_simply(REQUEST)

    sent = seen[0]
    assert sent["model"] == "claude-haiku-5-5"
    assert sent["output_config"]["effort"] == "low"
    assert sent["output_config"]["format"]["schema"]["required"] == ["gist", "points"]
    assert json.loads(sent["messages"][0]["content"]) == {
        "title": "BNM keeps OPR at 2.75%",
        "source": "The Star",
        "text": "Bank Negara kept the OPR at 2.75% on Thursday.",
    }


def test_an_answer_cut_short_fails_with_its_usage() -> None:
    def cut_short(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={**saved_summary(), "stop_reason": "max_tokens"})

    language_model, _ = model(cut_short)

    with pytest.raises(SimpleSummaryFailed, match="max_tokens") as raised:
        language_model.summarise_simply(REQUEST)
    assert raised.value.usage is not None


@pytest.mark.parametrize(
    "text",
    ['{"gist": "Something.", "points": []}', '{"gist": " ", "points": ["A point."]}', "not json"],
)
def test_an_empty_or_malformed_summary_fails_with_its_usage(text: str) -> None:
    language_model, _ = model(lambda request: httpx2.Response(200, json=with_text(text)))

    with pytest.raises(SimpleSummaryFailed) as raised:
        language_model.summarise_simply(REQUEST)
    assert raised.value.usage is not None


def test_a_failed_call_fails_without_usage() -> None:
    def refused(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(400, json={"type": "error", "error": {"message": "bad"}})

    language_model, _ = model(refused)

    with pytest.raises(SimpleSummaryFailed, match="summarise simply failed") as raised:
        language_model.summarise_simply(REQUEST)
    assert raised.value.usage is None
