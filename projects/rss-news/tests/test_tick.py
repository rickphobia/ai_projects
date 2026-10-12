import logging
from datetime import timedelta

import pytest

from rss_news.tick import Tick, TickStep
from tests.support import FakeClock


def test_a_failing_step_is_logged_and_the_later_steps_still_run(
    caplog: pytest.LogCaptureFixture,
) -> None:
    ran: list[str] = []

    def broken() -> None:
        raise RuntimeError("mailbox unreachable")

    tick = Tick(
        [
            TickStep("read the mailbox", broken),
            TickStep("score new items", lambda: ran.append("score")),
        ],
        FakeClock(),
    )

    with caplog.at_level(logging.ERROR):
        tick.run()

    assert ran == ["score"]
    (record,) = caplog.records
    assert record.getMessage() == "tick step failed"
    assert record.__dict__["step"] == "read the mailbox"


def test_a_tick_with_a_failing_step_is_not_a_success() -> None:
    def broken() -> None:
        raise RuntimeError("broken")

    clock = FakeClock()
    tick = Tick([TickStep("ok", lambda: None), TickStep("broken", broken)], clock)

    tick.run()

    assert tick.last_success() is None


def test_the_last_success_is_when_every_step_last_succeeded() -> None:
    clock = FakeClock()
    tick = Tick([TickStep("ok", lambda: None)], clock)

    tick.run()
    first = clock.now()
    clock.advance(timedelta(minutes=1))

    assert tick.last_success() == first
