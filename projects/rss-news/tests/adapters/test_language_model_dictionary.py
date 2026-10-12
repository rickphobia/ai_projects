"""Defining a word through the Anthropic LanguageModel, against a saved response."""

import json
from typing import Any

import httpx2
import pytest

from rss_news.dictionary.lookup import DefinitionRequest, DictionaryFailed
from tests.adapters.test_language_model import SAVED, model

REQUEST = DefinitionRequest("OPR", "Bank Negara kept the OPR at 2.75% on Thursday.")


def saved_definition() -> dict[str, Any]:
    body: dict[str, Any] = json.loads((SAVED / "definition-response.json").read_text())
    return body


def ok(request: httpx2.Request) -> httpx2.Response:
    return httpx2.Response(200, json=saved_definition())


def test_a_saved_definition_gives_the_text_and_usage_under_the_model_asked_for() -> None:
    language_model, _ = model(ok)

    result = language_model.define_word(REQUEST)

    assert result.definition == (
        "Overnight Policy Rate: the interest rate Bank Negara Malaysia sets for overnight "
        "lending between banks."
    )
    # The price is keyed by the configured name, not the dated snapshot the API answers with.
    assert result.usage.model == "claude-haiku-5-5"
    assert (result.usage.input_tokens, result.usage.output_tokens) == (312, 58)


def test_the_request_asks_the_dictionary_model_for_json_with_the_term_and_its_context() -> None:
    seen: list[dict[str, Any]] = []

    def answer(request: httpx2.Request) -> httpx2.Response:
        seen.append(json.loads(request.content))
        return ok(request)

    language_model, _ = model(answer)
    language_model.define_word(REQUEST)

    sent = seen[0]
    assert sent["model"] == "claude-haiku-5-5"
    assert sent["output_config"]["effort"] == "low"
    assert sent["output_config"]["format"]["schema"]["required"] == ["definition"]
    assert json.loads(sent["messages"][0]["content"]) == {
        "term": "OPR",
        "context": "Bank Negara kept the OPR at 2.75% on Thursday.",
    }


def test_an_answer_cut_short_fails_with_its_usage() -> None:
    def cut_short(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={**saved_definition(), "stop_reason": "max_tokens"})

    language_model, _ = model(cut_short)

    with pytest.raises(DictionaryFailed, match="max_tokens") as raised:
        language_model.define_word(REQUEST)
    assert raised.value.usage is not None


def test_a_failed_call_fails_without_usage() -> None:
    def refused(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(400, json={"type": "error", "error": {"message": "bad"}})

    language_model, _ = model(refused)

    with pytest.raises(DictionaryFailed, match="define word failed") as raised:
        language_model.define_word(REQUEST)
    assert raised.value.usage is None
