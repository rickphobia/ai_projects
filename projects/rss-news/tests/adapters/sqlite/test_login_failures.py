from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

import pytest

from rss_news.adapters.sqlite.database import SqliteDatabase
from rss_news.adapters.sqlite.login_failures import SqliteLoginFailures

NOON = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)


@pytest.fixture
def failures(tmp_path: Path) -> SqliteLoginFailures:
    database = SqliteDatabase(tmp_path / "court-booker.sqlite3")
    database.migrate()
    return SqliteLoginFailures(database)


def test_since_returns_later_failures_oldest_first(failures: SqliteLoginFailures) -> None:
    for minutes in (10, 0, 5):
        failures.record(NOON + timedelta(minutes=minutes))

    assert failures.since(NOON) == [NOON + timedelta(minutes=5), NOON + timedelta(minutes=10)]


def test_times_in_other_zones_compare_as_utc(failures: SqliteLoginFailures) -> None:
    malaysia = timezone(timedelta(hours=8))
    failures.record(datetime(2026, 10, 6, 20, 1, tzinfo=malaysia))  # 12:01 UTC

    assert failures.since(NOON) == [NOON + timedelta(minutes=1)]


def test_forget_before_and_clear_remove_failures(failures: SqliteLoginFailures) -> None:
    failures.record(NOON)
    failures.record(NOON + timedelta(minutes=20))

    failures.forget_before(NOON + timedelta(minutes=10))
    assert failures.since(NOON - timedelta(days=1)) == [NOON + timedelta(minutes=20)]

    failures.clear()
    assert failures.since(NOON - timedelta(days=1)) == []


def test_naive_times_are_refused(failures: SqliteLoginFailures) -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        failures.record(datetime(2026, 10, 6, 12, 0))
