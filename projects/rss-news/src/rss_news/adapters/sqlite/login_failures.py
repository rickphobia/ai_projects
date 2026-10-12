"""Failed login times in SQLite, for the login lockout."""

from datetime import datetime

from rss_news.adapters.sqlite.database import SqliteDatabase, from_db_time, to_db_time


class SqliteLoginFailures:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def record(self, at: datetime) -> None:
        with self._database.connection() as connection:
            connection.execute(
                "INSERT INTO login_failures (failed_at) VALUES (?)", (to_db_time(at),)
            )

    def since(self, start: datetime) -> list[datetime]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT failed_at FROM login_failures WHERE failed_at > ? ORDER BY failed_at",
                (to_db_time(start),),
            ).fetchall()
        return [from_db_time(row[0]) for row in rows]

    def forget_before(self, cutoff: datetime) -> None:
        with self._database.connection() as connection:
            connection.execute(
                "DELETE FROM login_failures WHERE failed_at < ?", (to_db_time(cutoff),)
            )

    def clear(self) -> None:
        with self._database.connection() as connection:
            connection.execute("DELETE FROM login_failures")
