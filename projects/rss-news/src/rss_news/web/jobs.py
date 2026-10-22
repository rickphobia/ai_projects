"""Following a job as server-sent events: the stream a Briefing or Chat question answers with,
and following it again by its id after the page was closed."""

import asyncio
import json
from collections.abc import AsyncIterator, Iterator
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from rss_news.jobs.running import Job, JobEvent, Jobs

jobs_router = APIRouter(prefix="/api/jobs")
# A comment this often keeps proxies (the host nginx closes after 60 s) from dropping a stream
# while a long section is written, and lets the server notice a closed page.
KEEP_ALIVE = timedelta(seconds=15)


def jobs_of(request: Request) -> Jobs:
    jobs: Jobs = request.app.state.jobs
    return jobs


@jobs_router.get("/{job_id}")
def follow_job(request: Request, job_id: str) -> StreamingResponse:
    """The job's stream from its start: what its POST answered with, so far or in full. 404
    once the server no longer knows it, such as after a restart."""
    job = jobs_of(request).get(job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail="That job isn't running any more; the server restarted or forgot it. "
            "Nothing of it was saved.",
        )
    return followed(job)


def followed(job: Job) -> StreamingResponse:
    """A `text/event-stream` of the job: a `job` event with its id, then its events as they
    come. Closing it leaves the job running."""
    return event_stream(_follow(job))


def event_stream(events: Iterator[str] | AsyncIterator[str]) -> StreamingResponse:
    # no-transform and X-Accel-Buffering keep proxies (the host nginx) from holding events back.
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


async def _follow(job: Job) -> AsyncIterator[str]:
    yield sse(JobEvent("job", {"id": job.id}))
    seen = 0
    while True:
        # Waiting in a worker thread; a closed page cancels this await at once.
        events, finished = await asyncio.to_thread(
            job.events_after, seen, timeout=KEEP_ALIVE.total_seconds()
        )
        for event in events:
            yield sse(event)
        seen += len(events)
        if finished:
            return
        if not events:
            yield ": still working\n\n"


def sse(event: JobEvent) -> str:
    return f"event: {event.name}\ndata: {json.dumps(event.data, ensure_ascii=False)}\n\n"
