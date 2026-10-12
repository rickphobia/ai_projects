"""Briefings over the JSON API: the latest one, the cost estimate, and writing one with its
progress streamed as server-sent events."""

import json
import logging
from collections.abc import Iterator
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from rss_news.briefings.briefing import ALL_SOURCES_24H, Briefing, BriefingFailed, NothingToBrief
from rss_news.briefings.writing import BriefingPlan, BriefingProgress, Briefings

logger = logging.getLogger(__name__)

briefings_router = APIRouter(prefix="/api/briefings")
# Costs are shown to the cent.
_CENT_FRACTION = Decimal("0.01")


class NewBriefing(BaseModel):
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


@briefings_router.get("/estimate")
def estimate(request: Request) -> dict[str, Any]:
    """What pressing "Brief me" would cost, worked out without calling the model."""
    briefings = briefings_of(request)
    try:
        plan = briefings.plan(ALL_SOURCES_24H)
    except NothingToBrief:
        return {"item_count": 0, "section_count": 0, "estimated_cost_usd": "0.00"}
    return {
        "item_count": plan.item_count,
        "section_count": len(plan.sections),
        "estimated_cost_usd": str(briefings.estimated_cost(plan).quantize(_CENT_FRACTION)),
    }


@briefings_router.post("")
def create_briefing(request: Request, body: NewBriefing) -> StreamingResponse:
    """A `text/event-stream`: `progress` events, then `briefing` (with `reused` true when
    today's saved one is given back) or `failed` with a `detail` for the owner. 422 when there
    is nothing to brief."""
    briefings = briefings_of(request)
    saved = None if body.regenerate else briefings.saved_today(ALL_SOURCES_24H)
    if saved is not None:
        logger.info("briefing reused", extra={"briefing_id": saved.id})
        events: Iterator[str] = iter([_event("briefing", _done_json(saved, reused=True))])
    else:
        try:
            plan = briefings.plan(ALL_SOURCES_24H)
        except NothingToBrief as error:
            raise HTTPException(status_code=422, detail=str(error)) from None
        events = _written(briefings, plan)
    # no-transform and X-Accel-Buffering keep proxies (the host nginx) from holding events back.
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


def _written(briefings: Briefings, plan: BriefingPlan) -> Iterator[str]:
    try:
        for step in briefings.write(plan):
            if isinstance(step, BriefingProgress):
                yield _event(
                    "progress",
                    {
                        "step": step.step,
                        "section": step.section,
                        "sections": step.sections,
                        "folder": step.folder_name,
                    },
                )
            else:
                yield _event("briefing", _done_json(step, reused=False))
    except BriefingFailed as error:
        # The stream has started, so the status is already 200: the failure is an event.
        yield _event(
            "failed",
            {"detail": f"The Briefing couldn't be written, and nothing was saved: {error}."},
        )
    except Exception:
        # A bug or a database error: still tell the owner, instead of a stream that just stops.
        logger.exception("briefing failed unexpectedly", extra={"scope": plan.scope.key})
        yield _event(
            "failed",
            {
                "detail": "The Briefing couldn't be written, and nothing was saved: "
                "something went wrong on the server; see its logs."
            },
        )


def _event(name: str, data: dict[str, Any]) -> str:
    return f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _done_json(briefing: Briefing, *, reused: bool) -> dict[str, Any]:
    return {"briefing": briefing_json(briefing), "reused": reused}


def briefing_json(briefing: Briefing) -> dict[str, Any]:
    return {
        "id": briefing.id,
        "scope": briefing.scope_key,
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
