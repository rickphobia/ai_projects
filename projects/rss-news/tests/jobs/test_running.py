"""Jobs: running on with nobody following, replaying to whoever follows, one job per key, a
crash ending as a failure, and forgetting old finished jobs."""

import threading
from collections.abc import Iterator

import pytest

from rss_news.jobs.running import JobEvent, JobRunning, Jobs

DONE = JobEvent("done", {"answer": 42})
CRASHED = JobEvent("failed", {"detail": "something went wrong"})
WAIT = 5.0


def steps(*events: JobEvent, gate: threading.Event | None = None) -> Iterator[JobEvent]:
    """The events, holding back all but the first until `gate` is set."""
    for number, event in enumerate(events):
        if number == 1 and gate is not None:
            assert gate.wait(WAIT), "the test never opened the gate"
        yield event


def test_a_job_runs_to_the_end_with_nobody_following() -> None:
    finished: list[JobEvent] = []
    jobs = Jobs()

    job = jobs.start(
        "briefing-all-24h",
        steps(JobEvent("progress", {}), DONE),
        crashed=CRASHED,
        on_finished=finished.append,
    )

    assert job.wait_finished(WAIT)
    assert job.outcome == DONE
    assert finished == [DONE]
    assert jobs.get(job.id) is job


def test_a_follower_gets_every_event_from_the_start_even_after_the_end() -> None:
    jobs = Jobs()
    job = jobs.start("key", steps(JobEvent("progress", {"step": 1}), DONE), crashed=CRASHED)
    job.wait_finished(WAIT)

    events, finished = job.events_after(0, timeout=0)

    assert events == [JobEvent("progress", {"step": 1}), DONE]
    assert finished


def test_events_after_waits_for_the_next_event() -> None:
    gate = threading.Event()
    jobs = Jobs()
    job = jobs.start("key", steps(JobEvent("progress", {}), DONE, gate=gate), crashed=CRASHED)

    first, _ = job.events_after(0, timeout=WAIT)
    nothing_yet, finished = job.events_after(1, timeout=0.05)
    gate.set()
    rest, _ = job.events_after(1, timeout=WAIT)

    assert first == [JobEvent("progress", {})]
    assert (nothing_yet, finished) == ([], False)
    assert rest == [DONE]


def test_only_one_job_runs_per_key_at_a_time() -> None:
    gate = threading.Event()
    jobs = Jobs()
    running = jobs.start("key", steps(JobEvent("progress", {}), DONE, gate=gate), crashed=CRASHED)

    with pytest.raises(JobRunning) as refused:
        jobs.start("key", steps(DONE), crashed=CRASHED)
    assert refused.value.job is running
    assert jobs.running("key") is running
    other = jobs.start("other-key", steps(DONE), crashed=CRASHED)
    assert other is not running

    gate.set()
    running.wait_finished(WAIT)
    assert jobs.running("key") is None
    assert jobs.start("key", steps(DONE), crashed=CRASHED).wait_finished(WAIT)


def test_a_crash_ends_the_job_with_its_crash_event() -> None:
    def broken() -> Iterator[JobEvent]:
        yield JobEvent("progress", {})
        raise RuntimeError("a bug")

    finished: list[JobEvent] = []
    job = Jobs().start("key", broken(), crashed=CRASHED, on_finished=finished.append)

    assert job.wait_finished(WAIT)
    assert job.outcome == CRASHED
    assert finished == [CRASHED]


def test_a_failing_finishing_step_still_finishes_the_job() -> None:
    def broken(_: JobEvent) -> None:
        raise RuntimeError("push service down")

    jobs = Jobs()
    job = jobs.start("key", steps(DONE), crashed=CRASHED, on_finished=broken)

    assert job.wait_finished(WAIT)
    assert job.outcome == DONE
    assert jobs.running("key") is None


def test_the_oldest_finished_jobs_are_forgotten() -> None:
    jobs = Jobs(keep_finished=2)
    started = []
    for number in range(3):
        job = jobs.start(f"key-{number}", steps(DONE), crashed=CRASHED)
        job.wait_finished(WAIT)
        started.append(job)

    assert [jobs.get(job.id) for job in started] == [None, started[1], started[2]]


def test_job_ids_are_not_counters() -> None:
    jobs = Jobs()
    first = jobs.start("a", steps(DONE), crashed=CRASHED)
    second = jobs.start("b", steps(DONE), crashed=CRASHED)

    # Random, so an id remembered from before a restart never names a new job.
    assert len(first.id) >= 16
    assert first.id != second.id
