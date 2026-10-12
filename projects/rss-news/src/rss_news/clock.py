"""The current time, behind an interface so tests can move time forward."""

from datetime import UTC, datetime
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime:
        """The current time, timezone-aware in UTC."""
        ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)
