"""Simple summaries of one Item over the JSON API: the saved one, and writing a new one in a job
streamed as server-sent events."""

import logging
from collections.abc import Iterator
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from rss_news.items.reading import ItemNotFound
from rss_news.jobs.running import JobEvent, JobRunning
from rss_news.simple_summaries.summarising import (
    NothingToSummarise,
    SimpleSummaries,
    SimpleSummary,
    SimpleSummaryFailed,
)
from rss_news.spending.limit import SpendingStopped
from rss_news.web.jobs import followed, jobs_of

logger = logging.getLogger(__name__)

simple_summaries_router = APIRouter(prefix="/api/items")
# A summary costs a fraction of a cent, so the owner sees it to the hundredth of a cent.
_COST_FRACTION = Decimal("0.0001")


def summaries_of(request: Request) -> SimpleSummaries:
    summaries: SimpleSummaries = request.app.state.simple_summaries
    return summaries


@simple_summaries_router.get("/{item_id}/simple-summary")
def saved_summary(request: Request, item_id: int) -> dict[str, Any]:
    """`{"summary": null}` until Summarise is first pressed; 404 for an unknown Item."""
    try:
        summary = summaries_of(request).saved(item_id)
    except ItemNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None
    return {"summary": None if summary is None else summary_json(summary)}


@simple_summaries_router.post("/{item_id}/simple-summary")
def summarise_simply(request: Request, item_id: int) -> StreamingResponse:
    """The whole Item explained in plain words: a one-sentence gist and a few points. A
    `text/event-stream`: `job` with the id to follow it again by (web/jobs.py), then `summary`,
    or `failed` with a `detail` for the owner (no text to summarise, or no summary from the
    model). Written in a job, so it is saved for the Item even if the page is closed, and
    pressing again while it is written follows that job. Each finished press is a new model
    call that replaces the saved summary. 404 for an unknown Item, 429 when this month's
    spending limit is reached."""
    summaries = summaries_of(request)
    jobs = jobs_of(request)
    key = f"simple-summary-{item_id}"
    running = jobs.running(key)
    if running is not None:
        logger.info("simple summary joined", extra={"job_id": running.id, "item_id": item_id})
        return followed(running)
    try:
        summaries.check_can_summarise(item_id)
    except ItemNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None
    except SpendingStopped as error:
        raise HTTPException(status_code=429, detail=str(error)) from None
    # No Alert when it finishes: it takes seconds, so the owner is usually still on the page.
    try:
        job = jobs.start(key, _summarised(summaries, item_id), crashed=_failed(_SERVER_TROUBLE))
    except JobRunning as started_meanwhile:
        # Another press started it since the check above; this one never runs.
        job = started_meanwhile.job
    return followed(job)


_SERVER_TROUBLE = "something went wrong on the server; see its logs"


def _summarised(summaries: SimpleSummaries, item_id: int) -> Iterator[JobEvent]:
    # The stream has started, so the status is already 200: each failure is an event.
    try:
        summary = summaries.summarise(item_id)
    except NothingToSummarise as error:
        yield JobEvent("failed", {"detail": f"Nothing to summarise: {error}."})
    except (ItemNotFound, SpendingStopped) as error:
        # Deleted or stopped between the press and the job starting.
        yield JobEvent("failed", {"detail": str(error)})
    except SimpleSummaryFailed as error:
        yield _failed(str(error))
    except Exception:
        # A bug or a database error: still tell the owner, instead of a stream that just stops.
        logger.exception("simple summary failed unexpectedly", extra={"item_id": item_id})
        yield _failed(_SERVER_TROUBLE)
    else:
        yield JobEvent("summary", summary_json(summary))


def _failed(reason: str) -> JobEvent:
    return JobEvent("failed", {"detail": f"The summary couldn't be written: {reason}."})


def summary_json(summary: SimpleSummary) -> dict[str, Any]:
    return {
        "gist": summary.gist,
        "points": summary.points,
        "from_preview": summary.from_preview,
        "cost_usd": str(summary.cost_usd.quantize(_COST_FRACTION)),
    }
