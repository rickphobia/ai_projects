"""Simple summaries of one Item over the JSON API."""

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from rss_news.items.reading import ItemNotFound
from rss_news.simple_summaries.summarising import (
    NothingToSummarise,
    SimpleSummaries,
    SimpleSummaryFailed,
)
from rss_news.spending.limit import SpendingStopped

simple_summaries_router = APIRouter(prefix="/api/items")
# A summary costs a fraction of a cent, so the owner sees it to the hundredth of a cent.
_COST_FRACTION = Decimal("0.0001")


@simple_summaries_router.post("/{item_id}/simple-summary")
def summarise_simply(request: Request, item_id: int) -> dict[str, Any]:
    """The whole Item explained in plain words: a one-sentence gist and a few points. Not
    saved, so each call is a new model call. 404 for an unknown Item, 422 when it has no text,
    429 when this month's spending limit is reached, 502 when the model gives no summary."""
    summaries: SimpleSummaries = request.app.state.simple_summaries
    try:
        summary = summaries.summarise(item_id)
    except ItemNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None
    except NothingToSummarise as error:
        raise HTTPException(status_code=422, detail=f"Nothing to summarise: {error}.") from None
    except SpendingStopped as error:
        raise HTTPException(status_code=429, detail=str(error)) from None
    except SimpleSummaryFailed as error:
        raise HTTPException(
            status_code=502, detail=f"The summary couldn't be written: {error}."
        ) from None
    return {
        "gist": summary.gist,
        "points": summary.points,
        "from_preview": summary.from_preview,
        "cost_usd": str(summary.cost_usd.quantize(_COST_FRACTION)),
    }
