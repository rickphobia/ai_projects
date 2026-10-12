"""The tick: the steps the app runs every minute, in order, and when it last succeeded."""

import logging
import threading
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from rss_news.clock import Clock

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TickStep:
    name: str
    run: Callable[[], None]


class Tick:
    def __init__(self, steps: Sequence[TickStep], clock: Clock) -> None:
        self._steps = steps
        self._clock = clock
        self._last_success: datetime | None = None

    def run(self) -> None:
        """Run every step. A step's failure is logged and doesn't stop the later steps, but
        the tick then doesn't count as a success."""
        all_succeeded = True
        for step in self._steps:
            try:
                step.run()
            except Exception:
                logger.exception("tick step failed", extra={"step": step.name})
                all_succeeded = False
        if all_succeeded:
            self._last_success = self._clock.now()

    def last_success(self) -> datetime | None:
        """When a tick last finished with every step succeeding; None before the first."""
        return self._last_success


class TickLoop:
    """Runs the tick in a background thread: one right away, then one every interval."""

    def __init__(self, tick: Tick, interval: timedelta) -> None:
        self._tick = tick
        self._interval = interval
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        # A thread, not an asyncio task: fetching is blocking I/O and must not hold up the
        # web server.
        self._thread = threading.Thread(target=self._loop, name="tick", daemon=True)
        self._thread.start()
        logger.info("tick loop started", extra={"interval_seconds": self._interval.seconds})

    def stop(self) -> None:
        """Ask the loop to stop and wait a few seconds for a tick in progress."""
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
            if self._thread.is_alive():
                logger.warning("tick still running at shutdown; it is cut short")

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._tick.run()
            self._stop.wait(self._interval.total_seconds())
