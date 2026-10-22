"""Jobs: work a request starts, such as writing a Briefing, that runs on in a thread of the
server process after the request has gone, so leaving the page doesn't stop it.

A job keeps every event it produced, so whoever follows it, now or after coming back, gets them
all from the start. Jobs live only in memory: a server restart loses the running ones
(decision 0007)."""

import logging
import secrets
import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

# Finished jobs kept so a follower coming back can still read how they ended.
KEEP_FINISHED = 50


@dataclass(frozen=True)
class JobEvent:
    """One step of a job as its followers receive it, such as a Briefing's progress."""

    name: str
    data: dict[str, Any]


class JobRunning(Exception):
    """A job with this key is already running; `job` is that one."""

    def __init__(self, job: "Job") -> None:
        super().__init__(f"job {job.key} is already running")
        self.job = job


class Job:
    def __init__(self, key: str) -> None:
        # Random rather than counted, so an id kept from before a restart names no new job.
        self.id = secrets.token_hex(12)
        self.key = key
        self._events: list[JobEvent] = []
        self._finished = False
        self._changed = threading.Condition()
        # Set once the finishing step, such as a push message, is done too.
        self._settled = threading.Event()

    @property
    def finished(self) -> bool:
        with self._changed:
            return self._finished

    @property
    def outcome(self) -> JobEvent | None:
        """The last event once the job has finished; None before."""
        with self._changed:
            return self._events[-1] if self._finished and self._events else None

    def events_after(self, seen: int, *, timeout: float) -> tuple[list[JobEvent], bool]:
        """The events after the first `seen`, waiting up to `timeout` seconds for one, and
        whether the job has finished (so no more will come)."""
        with self._changed:
            self._changed.wait_for(
                lambda: self._finished or len(self._events) > seen, timeout=timeout
            )
            return self._events[seen:], self._finished

    def wait_finished(self, timeout: float) -> bool:
        """Wait until the job and its finishing step are done."""
        return self._settled.wait(timeout)

    def _add(self, event: JobEvent) -> None:
        with self._changed:
            self._events.append(event)
            self._changed.notify_all()

    def _finish(self) -> None:
        with self._changed:
            self._finished = True
            self._changed.notify_all()


class Jobs:
    """The jobs of this server process: at most one running per key, each in its own thread."""

    def __init__(self, *, keep_finished: int = KEEP_FINISHED) -> None:
        self._keep_finished = keep_finished
        self._lock = threading.Lock()
        self._by_id: dict[str, Job] = {}
        self._running: dict[str, Job] = {}
        # Oldest first, so the oldest is forgotten first.
        self._finished: OrderedDict[str, None] = OrderedDict()

    def start(
        self,
        key: str,
        steps: Iterator[JobEvent],
        *,
        crashed: JobEvent,
        on_finished: Callable[[JobEvent], None] | None = None,
    ) -> Job:
        """Run `steps` in a new thread. If they raise, the job ends with `crashed`.
        `on_finished` gets the last event once followers have it. Raises JobRunning when a job
        with this key is still running; `steps` is then never started."""
        with self._lock:
            running = self._running.get(key)
            if running is not None:
                raise JobRunning(running)
            job = Job(key)
            self._by_id[job.id] = job
            self._running[key] = job
        # Daemon: a job doesn't hold up the server's shutdown; it is lost with it.
        threading.Thread(
            target=self._run,
            args=(job, steps, crashed, on_finished),
            name=f"job {key}",
            daemon=True,
        ).start()
        return job

    def running(self, key: str) -> Job | None:
        with self._lock:
            return self._running.get(key)

    def get(self, job_id: str) -> Job | None:
        """A running job, or a recently finished one."""
        with self._lock:
            return self._by_id.get(job_id)

    def _run(
        self,
        job: Job,
        steps: Iterator[JobEvent],
        crashed: JobEvent,
        on_finished: Callable[[JobEvent], None] | None,
    ) -> None:
        started = time.monotonic()
        logger.info("job started", extra={"job_id": job.id, "key": job.key})
        try:
            for event in steps:
                job._add(event)
        except Exception:
            logger.exception("job crashed", extra={"job_id": job.id, "key": job.key})
            job._add(crashed)
        finally:
            job._finish()
            self._forget_running(job)
        outcome = job.outcome
        logger.info(
            "job finished",
            extra={
                "job_id": job.id,
                "key": job.key,
                "outcome": None if outcome is None else outcome.name,
                "duration_ms": round((time.monotonic() - started) * 1000),
            },
        )
        try:
            if outcome is not None and on_finished is not None:
                on_finished(outcome)
        except Exception:
            # The result is saved and followers have it; only the follow-up, such as a push
            # message, is missing.
            logger.exception("job's finishing step failed", extra={"job_id": job.id})
        finally:
            job._settled.set()

    def _forget_running(self, job: Job) -> None:
        with self._lock:
            if self._running.get(job.key) is job:
                del self._running[job.key]
            self._finished[job.id] = None
            while len(self._finished) > self._keep_finished:
                oldest, _ = self._finished.popitem(last=False)
                self._by_id.pop(oldest, None)
