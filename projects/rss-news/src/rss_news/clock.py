"""The current time and waiting, behind an interface so tests can move time forward."""

import time
from datetime import UTC, datetime, timedelta
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime:
        """The current time, timezone-aware in UTC."""
        ...

    def sleep(self, delta: timedelta) -> None:
        """Block for `delta`; a fake clock moves its time forward instead."""
        ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)

    def sleep(self, delta: timedelta) -> None:
        time.sleep(max(delta.total_seconds(), 0))
