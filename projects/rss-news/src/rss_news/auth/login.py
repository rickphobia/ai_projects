"""Checks the owner password, with lockout after repeated failures."""

import math
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Protocol

from rss_news.auth.passwords import PasswordHash
from rss_news.clock import Clock


class LoginFailures(Protocol):
    """Where failed login times are kept, so a restart doesn't reset the lockout."""

    def record(self, at: datetime) -> None: ...

    def since(self, start: datetime) -> list[datetime]:
        """Failure times after `start`, oldest first."""
        ...

    def forget_before(self, cutoff: datetime) -> None: ...

    def clear(self) -> None: ...


@dataclass(frozen=True)
class LoggedIn:
    pass


@dataclass(frozen=True)
class WrongPassword:
    pass


@dataclass(frozen=True)
class LockedOut:
    minutes_left: int


LoginResult = LoggedIn | WrongPassword | LockedOut


@dataclass(frozen=True)
class OwnerLogin:
    password_hash: PasswordHash
    failures: LoginFailures
    clock: Clock
    max_failures: int
    lockout: timedelta
    # One attempt at a time: parallel guesses can't slip past the failure count, and only
    # one memory-hungry scrypt check runs at once.
    _lock: threading.Lock = field(
        default_factory=threading.Lock, init=False, repr=False, compare=False
    )

    def attempt(self, password: str) -> LoginResult:
        """Check `password`, refusing every attempt while too many recent ones have failed.

        The lock starts at the failure that makes `max_failures` within `lockout`, and lasts
        `lockout` from then. Attempts refused by the lock aren't recorded, so someone hammering
        the form can't stretch it: it lifts on time and the count starts again.
        """
        with self._lock:
            now = self.clock.now()
            unlocks_at = self._unlocks_at(now)
            if unlocks_at is not None:
                minutes_left = math.ceil((unlocks_at - now).total_seconds() / 60)
                return LockedOut(minutes_left=max(minutes_left, 1))
            if self.password_hash.matches(password):
                self.failures.clear()
                return LoggedIn()
            self.failures.record(now)
            # Only failures that could still be part of a lock matter (see _unlocks_at).
            self.failures.forget_before(now - 2 * self.lockout)
            return WrongPassword()

    def _unlocks_at(self, now: datetime) -> datetime | None:
        """When the current lock lifts, or None if login isn't locked."""
        # A lock still running started within `lockout`, from failures within `lockout` of that.
        recent = self.failures.since(now - 2 * self.lockout)
        if not recent:
            return None
        # Refused attempts aren't recorded, so the newest failure is the one that set any lock.
        newest = recent[-1]
        unlocks_at = newest + self.lockout
        counted = [moment for moment in recent if moment > newest - self.lockout]
        if len(counted) >= self.max_failures and now < unlocks_at:
            return unlocks_at
        return None
