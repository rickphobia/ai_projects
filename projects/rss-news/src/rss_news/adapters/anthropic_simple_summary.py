"""The Simple summary call's prompt, output schema and answer parsing."""

import json
from typing import Any

from rss_news.simple_summaries.summarising import (
    SimpleSummaryFailed,
    SimpleSummaryRequest,
    WrittenSimpleSummary,
)
from rss_news.spending.ledger import AiUsage

# A gist and a few points; the rest is room for the model's thinking.
SIMPLE_SUMMARY_MAX_TOKENS = 6_000

SIMPLE_SUMMARY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "gist": {"type": "string"},
        "points": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["gist", "points"],
    "additionalProperties": False,
}


def simple_summary_prompt(request: SimpleSummaryRequest) -> str:
    return json.dumps(
        {"title": request.title, "source": request.source_name, "text": request.text},
        ensure_ascii=False,
    )


def parse_simple_summary(answer_text: str, usage: AiUsage) -> WrittenSimpleSummary:
    """`answer_text` is the model's finished JSON answer."""
    try:
        answer = json.loads(answer_text)
        gist = " ".join(str(answer["gist"]).split())
        points = [" ".join(str(point).split()) for point in answer["points"]]
    except (ValueError, KeyError, TypeError) as error:
        raise SimpleSummaryFailed(f"answer is not the summary JSON: {error}", usage) from error
    points = [point for point in points if point]
    if not gist or not points:
        raise SimpleSummaryFailed("the summary is empty", usage)
    return WrittenSimpleSummary(gist, points)
