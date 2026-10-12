from datetime import datetime, timedelta

import pytest

from rss_news.auth.login import LockedOut, LoggedIn, OwnerLogin, WrongPassword
from rss_news.auth.passwords import parse_password_hash
from tests.support import OWNER_PASSWORD, OWNER_PASSWORD_HASH, FakeClock


class InMemoryLoginFailures:
    def __init__(self) -> None:
        self.times: list[datetime] = []

    def record(self, at: datetime) -> None:
        self.times.append(at)

    def since(self, start: datetime) -> list[datetime]:
        return sorted(time for time in self.times if time > start)

    def forget_before(self, cutoff: datetime) -> None:
        self.times = [time for time in self.times if time >= cutoff]

    def clear(self) -> None:
        self.times = []


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def login(clock: FakeClock) -> OwnerLogin:
    return OwnerLogin(
        password_hash=parse_password_hash(OWNER_PASSWORD_HASH),
        failures=InMemoryLoginFailures(),
        clock=clock,
        max_failures=3,
        lockout=timedelta(minutes=15),
    )


def test_the_right_password_logs_in(login: OwnerLogin) -> None:
    assert login.attempt(OWNER_PASSWORD) == LoggedIn()


def test_a_wrong_password_is_refused(login: OwnerLogin) -> None:
    assert login.attempt("guess") == WrongPassword()


def test_the_lock_lasts_the_full_lockout_from_the_failure_that_set_it(
    login: OwnerLogin, clock: FakeClock
) -> None:
    for _ in range(3):
        login.attempt("guess")
        clock.advance(timedelta(minutes=7))
    # Failures at 0, 7 and 14 minutes; now 21. The lock started at 14, so it holds until 29.
    assert login.attempt(OWNER_PASSWORD) == LockedOut(minutes_left=8)

    clock.advance(timedelta(minutes=8))
    assert login.attempt(OWNER_PASSWORD) == LoggedIn()


def test_failures_spread_wider_than_the_lockout_never_lock(
    login: OwnerLogin, clock: FakeClock
) -> None:
    for _ in range(3):
        login.attempt("guess")
        clock.advance(timedelta(minutes=8))

    assert login.attempt(OWNER_PASSWORD) == LoggedIn()


def test_minutes_left_round_up(login: OwnerLogin, clock: FakeClock) -> None:
    for _ in range(3):
        login.attempt("guess")

    clock.advance(timedelta(minutes=14, seconds=30))

    assert login.attempt(OWNER_PASSWORD) == LockedOut(minutes_left=1)


def test_refused_attempts_do_not_extend_the_lock(login: OwnerLogin, clock: FakeClock) -> None:
    for _ in range(3):
        login.attempt("guess")
    for _ in range(14):
        clock.advance(timedelta(minutes=1))
        login.attempt("guess")

    clock.advance(timedelta(minutes=1))

    assert login.attempt(OWNER_PASSWORD) == LoggedIn()


def test_a_successful_login_clears_earlier_failures(login: OwnerLogin) -> None:
    login.attempt("guess")
    login.attempt("guess")
    login.attempt(OWNER_PASSWORD)
    login.attempt("guess")
    login.attempt("guess")

    assert login.attempt(OWNER_PASSWORD) == LoggedIn()
