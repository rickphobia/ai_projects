"""Writing a Briefing section through the Anthropic LanguageModel, against a saved response."""

import json
from typing import Any

import httpx2
import pytest

from rss_news.briefings.briefing import (
    BriefingFailed,
    SectionItem,
    SectionRequest,
    WrittenPoint,
)
from tests.adapters.test_language_model import SAVED, model

SECTION = SectionRequest(
    "Macro",
    [
        SectionItem(101, "Fed cuts rates by 50 basis points", "Reuters", 5, "The Fed cut.", "Full"),
        SectionItem(102, "BNM kekalkan OPR", "Berita Harian", 3, "BNM held the OPR.", None),
    ],
)


def saved_section() -> dict[str, Any]:
    body: dict[str, Any] = json.loads((SAVED / "briefing-section-response.json").read_text())
    return body


def ok(request: httpx2.Request) -> httpx2.Response:
    return httpx2.Response(200, json=saved_section())


def test_a_saved_section_answer_gives_points_and_usage() -> None:
    language_model, _ = model(ok)

    result = language_model.write_briefing_section(SECTION)

    assert result.points == [
        WrittenPoint(
            "The Fed cut rates by half a point, more than expected, and signalled more cuts if "
            "jobs keep weakening.",
            [101],
        ),
        WrittenPoint(
            "Bank Negara held the OPR at 2.75%, saying inflation stays moderate.", [102, 104]
        ),
    ]
    assert result.usage.model == "claude-opus-5-5"
    assert (result.usage.input_tokens, result.usage.output_tokens) == (9120, 412)


def test_the_request_asks_the_briefing_model_at_its_effort_for_points_as_json() -> None:
    seen: list[dict[str, Any]] = []

    def answer(request: httpx2.Request) -> httpx2.Response:
        seen.append(json.loads(request.content))
        return ok(request)

    language_model, _ = model(answer)
    language_model.write_briefing_section(SECTION)

    (body,) = seen
    assert body["model"] == "claude-opus-5-5"
    assert body["output_config"]["effort"] == "low"
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert "names the ids of the Items" in body["system"]
    prompt = body["messages"][0]["content"]
    assert prompt.startswith("Write the Macro section")
    listed = json.loads(prompt[prompt.index("[") :])
    assert listed[0] == {
        "id": 101,
        "source": "Reuters",
        "title": "Fed cuts rates by 50 basis points",
        "importance": 5,
        "summary": "The Fed cut.",
        "full_text": "Full",
    }
    assert "full_text" not in listed[1]


def test_a_refused_section_fails_with_the_tokens_it_cost() -> None:
    refused = saved_section()
    refused["stop_reason"] = "refusal"
    refused["stop_details"] = {"type": "refusal", "category": "cyber", "explanation": None}
    refused["content"] = []
    language_model, _ = model(lambda request: httpx2.Response(200, json=refused))

    with pytest.raises(BriefingFailed, match=r"refusal \(cyber\)") as failure:
        language_model.write_briefing_section(SECTION)
    assert failure.value.usage is not None
    assert failure.value.usage.input_tokens == 9120


def test_an_unreachable_model_fails_the_section_without_usage() -> None:
    language_model, sleeps = model(lambda request: httpx2.Response(503, json={}), max_attempts=2)

    with pytest.raises(BriefingFailed, match="HTTP 503") as failure:
        language_model.write_briefing_section(SECTION)
    assert failure.value.usage is None
    assert len(sleeps) == 1
