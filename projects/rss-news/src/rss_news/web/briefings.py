"""Briefings over the JSON API: the saved ones, the cost estimate, and writing one in a job with
its progress streamed as server-sent events."""

import logging
from collections.abc import Iterator
from decimal import Decimal
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from rss_news.alerts.push import Alert, AlertPush
from rss_news.briefings.briefing import (
    WINDOWS,
    Briefing,
    BriefingFailed,
    BriefingScope,
    NothingToBrief,
    PickedScope,
    WindowScope,
)
from rss_news.briefings.writing import BriefingPlan, BriefingProgress, Briefings
from rss_news.jobs.running import JobEvent, JobRunning
from rss_news.spending.limit import SpendingStopped
from rss_news.web.jobs import event_stream, followed, jobs_of, sse

logger = logging.getLogger(__name__)

briefings_router = APIRouter(prefix="/api/briefings")
# Costs are shown to the cent.
_CENT_FRACTION = Decimal("0.01")


# More than a Briefing could use anyway: the token budget cuts each section to fit.
_MOST_PICKED_ITEMS = 500
type WindowName = Literal["24h", "7d", "30d"]


class ScopeRequest(BaseModel):
    """All Sources or one Folder over a window, or, when `item_ids` is given, those Items."""

    window: WindowName = "24h"
    folder_id: int | None = None
    item_ids: list[int] | None = Field(default=None, min_length=1, max_length=_MOST_PICKED_ITEMS)

    def scope(self) -> BriefingScope:
        if self.item_ids is not None:
            return PickedScope(frozenset(self.item_ids))
        return WindowScope(WINDOWS[self.window], self.folder_id)


class NewBriefing(ScopeRequest):
    # Write a new one even when one of this scope was saved today.
    regenerate: bool = False


def briefings_of(request: Request) -> Briefings:
    briefings: Briefings = request.app.state.briefings
    return briefings


@briefings_router.get("/latest")
def latest_briefing(request: Request) -> dict[str, Any]:
    """`{"briefing": null}` until the first one is written."""
    latest = briefings_of(request).latest()
    return {"briefing": None if latest is None else briefing_json(latest)}


@briefings_router.get("")
def list_briefings(request: Request) -> dict[str, Any]:
    """Every saved Briefing, newest first, without its points."""
    return {
        "briefings": [
            {key: value for key, value in briefing_json(briefing).items() if key != "sections"}
            for briefing in briefings_of(request).all_newest_first()
        ]
    }


@briefings_router.get("/estimate")
def estimate(
    request: Request,
    window: WindowName = "24h",
    folder: int | None = None,
    item: Annotated[list[int] | None, Query(max_length=_MOST_PICKED_ITEMS)] = None,
) -> dict[str, Any]:
    """What writing this scope's Briefing would cost, worked out without calling the model.
    Repeat `item` to price picked Items."""
    briefings = briefings_of(request)
    scope = ScopeRequest(window=window, folder_id=folder, item_ids=item or None).scope()
    try:
        plan = briefings.plan(scope)
    except NothingToBrief:
        return {"item_count": 0, "section_count": 0, "estimated_cost_usd": "0.00"}
    return {
        "item_count": plan.item_count,
        "section_count": len(plan.sections),
        "estimated_cost_usd": str(briefings.estimated_cost(plan).quantize(_CENT_FRACTION)),
    }


@briefings_router.get("/{briefing_id}")
def show_briefing(request: Request, briefing_id: int) -> dict[str, Any]:
    briefing = briefings_of(request).get(briefing_id)
    if briefing is None:
        raise HTTPException(status_code=404, detail="That Briefing doesn't exist.")
    return {"briefing": briefing_json(briefing)}


@briefings_router.post("")
def create_briefing(request: Request, body: NewBriefing) -> StreamingResponse:
    """A `text/event-stream`: `job` with the id to follow it again by (web/jobs.py), `progress`
    events, then `briefing` or `failed` with a `detail` for the owner. Today's saved Briefing
    is given back as just `briefing`, with `reused` true. The Briefing is written in a job, so
    it is saved even if the page is closed, and pressing again while its scope is being written
    follows that job. 422 when there is nothing to brief, 429 when this month's spending limit
    is reached."""
    briefings = briefings_of(request)
    jobs = jobs_of(request)
    scope = body.scope()
    saved = None if body.regenerate else briefings.saved_today(scope)
    if saved is not None:
        logger.info("briefing reused", extra={"briefing_id": saved.id})
        return event_stream(iter([sse(JobEvent("briefing", _done_json(saved, reused=True)))]))
    key = f"briefing-{scope.key}"
    running = jobs.running(key)
    if running is not None:
        logger.info("briefing joined", extra={"job_id": running.id, "scope": scope.key})
        return followed(running)
    try:
        plan = briefings.plan(scope)
    except NothingToBrief as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    try:
        steps = briefings.write(plan)
    except SpendingStopped as error:
        raise HTTPException(status_code=429, detail=str(error)) from None
    alert_push: AlertPush = request.app.state.alert_push
    try:
        job = jobs.start(
            key,
            _written(steps, plan),
            crashed=_failed(_SERVER_TROUBLE),
            on_finished=lambda outcome: _tell_owner(alert_push, outcome),
        )
    except JobRunning as started_meanwhile:
        # Another press started it since the check above; `steps` never runs.
        job = started_meanwhile.job
    return followed(job)


_SERVER_TROUBLE = "something went wrong on the server; see its logs"


def _written(
    steps: Iterator[BriefingProgress | Briefing], plan: BriefingPlan
) -> Iterator[JobEvent]:
    try:
        for step in steps:
            if isinstance(step, BriefingProgress):
                yield JobEvent(
                    "progress",
                    {
                        "step": step.step,
                        "section": step.section,
                        "sections": step.sections,
                        "folder": step.folder_name,
                    },
                )
            else:
                yield JobEvent("briefing", _done_json(step, reused=False))
    except BriefingFailed as error:
        # The stream has started, so the status is already 200: the failure is an event.
        yield _failed(str(error))
    except Exception:
        # A bug or a database error: still tell the owner, instead of a stream that just stops.
        logger.exception("briefing failed unexpectedly", extra={"scope": plan.scope.key})
        yield _failed(_SERVER_TROUBLE)


def _failed(reason: str) -> JobEvent:
    return JobEvent(
        "failed", {"detail": f"The Briefing couldn't be written, and nothing was saved: {reason}."}
    )


def _tell_owner(alert_push: AlertPush, outcome: JobEvent) -> None:
    """An Alert that opens the finished Briefing, or says it failed: the page that asked may
    be closed by now."""
    if outcome.name == "briefing":
        briefing = outcome.data["briefing"]
        alert = Alert(
            title="Your Briefing is ready",
            body=f"{briefing['title']}. Tap to read it.",
            item_id=None,
            briefing_id=briefing["id"],
        )
    else:
        alert = Alert(
            title="Your Briefing couldn't be written", body=outcome.data["detail"], item_id=None
        )
    alert_push.send_if_on(alert)


def _done_json(briefing: Briefing, *, reused: bool) -> dict[str, Any]:
    return {"briefing": briefing_json(briefing), "reused": reused}


def briefing_json(briefing: Briefing) -> dict[str, Any]:
    return {
        "id": briefing.id,
        "scope": briefing.scope_key,
        "title": briefing.title,
        "created_at": briefing.created_at.isoformat(),
        "item_count": briefing.item_count,
        "cost_usd": str(briefing.cost_usd.quantize(_CENT_FRACTION)),
        "sections": [
            {
                "folder": {"id": section.folder_id, "name": section.folder_name},
                "points": [
                    {
                        "text": point.text,
                        "items": [
                            {"id": item.id, "title": item.title, "source": item.source_name}
                            for item in point.items
                        ],
                    }
                    for point in section.points
                ],
            }
            for section in briefing.sections
        ],
    }
