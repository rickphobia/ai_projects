"""Folders and Sources in SQLite."""

from collections.abc import Sequence
from datetime import datetime

from rss_news.adapters.sqlite.database import SqliteDatabase, to_db_time
from rss_news.sources.catalog import Folder, Source, StarterFolder

_STARTER_LOADED = "starter sources loaded"


class SqliteSources:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def load_starter_once(self, folders: Sequence[StarterFolder]) -> bool:
        with self._database.connection() as connection:
            # Claiming the marker first, in the same transaction, means two processes
            # starting at once can't both load the set.
            claimed = connection.execute(
                "INSERT INTO done_once (name, done_at) VALUES (?, datetime('now')) "
                "ON CONFLICT (name) DO NOTHING",
                (_STARTER_LOADED,),
            ).rowcount
            if not claimed:
                return False
            next_position = connection.execute(
                "SELECT COALESCE(MAX(position), 0) + 1 FROM folders"
            ).fetchone()[0]
            for offset, folder in enumerate(folders):
                folder_id = connection.execute(
                    "INSERT INTO folders (name, position) VALUES (?, ?) "
                    "ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id",
                    (folder.name, next_position + offset),
                ).fetchone()[0]
                connection.executemany(
                    "INSERT INTO sources (folder_id, name, url) VALUES (?, ?, ?) "
                    "ON CONFLICT (url) DO NOTHING",
                    [(folder_id, source.name, source.url) for source in folder.sources],
                )
        return True

    def folders(self) -> list[Folder]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT id, name FROM folders ORDER BY position, id"
            ).fetchall()
        return [Folder(id=row[0], name=row[1]) for row in rows]

    def due(self, now: datetime) -> list[Source]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT id, folder_id, name, url, etag, last_modified FROM sources "
                "WHERE next_fetch_at IS NULL OR next_fetch_at <= ? "
                "ORDER BY next_fetch_at IS NOT NULL, next_fetch_at, id",
                (to_db_time(now),),
            ).fetchall()
        return [
            Source(
                id=row[0],
                folder_id=row[1],
                name=row[2],
                url=row[3],
                etag=row[4],
                last_modified=row[5],
            )
            for row in rows
        ]

    def record_success(
        self,
        source_id: int,
        *,
        at: datetime,
        next_fetch_at: datetime,
        etag: str | None,
        last_modified: str | None,
    ) -> None:
        with self._database.connection() as connection:
            connection.execute(
                "UPDATE sources SET last_success_at = ?, next_fetch_at = ?, etag = ?, "
                "last_modified = ? WHERE id = ?",
                (to_db_time(at), to_db_time(next_fetch_at), etag, last_modified, source_id),
            )

    def record_failure(
        self, source_id: int, *, at: datetime, next_fetch_at: datetime, error: str
    ) -> None:
        with self._database.connection() as connection:
            connection.execute(
                "UPDATE sources SET last_error_at = ?, last_error = ?, next_fetch_at = ? "
                "WHERE id = ?",
                (to_db_time(at), error, to_db_time(next_fetch_at), source_id),
            )
