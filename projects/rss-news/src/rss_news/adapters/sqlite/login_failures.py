"""Failed login times in SQLite, for the login lockout."""

from datetime import UTC, datetime

from rss_news.adapters.sqlite.database import SqliteDatabase


class SqliteLoginFailures:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def record(self, at: datetime) -> None:
        with self._database.connection() as connection:
            connection.execute("INSERT INTO login_failures (failed_at) VALUES (?)", (_iso(at),))

    def since(self, start: datetime) -> list[datetime]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT failed_at FROM login_failures WHERE failed_at > ? ORDER BY failed_at",
                (_iso(start),),
            ).fetchall()
        return [datetime.fromisoformat(row[0]) for row in rows]

    def forget_before(self, cutoff: datetime) -> None:
        with self._database.connection() as connection:
            connection.execute("DELETE FROM login_failures WHERE failed_at < ?", (_iso(cutoff),))

    def clear(self) -> None:
        with self._database.connection() as connection:
            connection.execute("DELETE FROM login_failures")


def _iso(moment: datetime) -> str:
    # One fixed-width UTC form, so comparing the text in SQL compares the times.
    if moment.utcoffset() is None:
        raise ValueError("login failure times must be timezone-aware")
    return moment.astimezone(UTC).isoformat(timespec="microseconds")
