"""Folders and Sources in SQLite."""

import sqlite3
from collections.abc import Sequence
from datetime import datetime

from rss_news.adapters.sqlite.database import SqliteDatabase, from_db_time, to_db_time
from rss_news.sources.catalog import (
    AlreadyExists,
    Folder,
    FolderNotEmpty,
    NotFound,
    Source,
    SourceStatus,
    StarterFolder,
)

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

    def sources(self) -> list[SourceStatus]:
        with self._database.connection() as connection:
            rows = connection.execute(
                f"SELECT {_STATUS_COLUMNS} FROM sources "
                "JOIN folders ON folders.id = sources.folder_id "
                "ORDER BY folders.position, folders.id, sources.name COLLATE NOCASE, sources.id"
            ).fetchall()
        return [_status(row) for row in rows]

    def add_folder(self, name: str) -> Folder:
        with self._database.connection() as connection:
            try:
                folder_id = connection.execute(
                    "INSERT INTO folders (name, position) "
                    "SELECT ?, COALESCE(MAX(position), 0) + 1 FROM folders RETURNING id",
                    (name,),
                ).fetchone()[0]
            except sqlite3.IntegrityError:
                raise AlreadyExists(f"there is already a Folder named {name!r}") from None
        return Folder(id=folder_id, name=name)

    def rename_folder(self, folder_id: int, name: str) -> None:
        with self._database.connection() as connection:
            try:
                renamed = connection.execute(
                    "UPDATE folders SET name = ? WHERE id = ?", (name, folder_id)
                ).rowcount
            except sqlite3.IntegrityError:
                raise AlreadyExists(f"there is already a Folder named {name!r}") from None
        if not renamed:
            raise NotFound(f"there is no Folder {folder_id}")

    def delete_folder(self, folder_id: int) -> None:
        with self._database.connection() as connection:
            _require_folder(connection, folder_id)
            count = connection.execute(
                "SELECT COUNT(*) FROM sources WHERE folder_id = ?", (folder_id,)
            ).fetchone()[0]
            if count:
                raise FolderNotEmpty(
                    f"the Folder still has {count} Source(s); move or remove them first"
                )
            connection.execute("DELETE FROM folders WHERE id = ?", (folder_id,))

    def add_source(self, folder_id: int, name: str, url: str) -> SourceStatus:
        with self._database.connection() as connection:
            _require_folder(connection, folder_id)
            try:
                source_id = connection.execute(
                    "INSERT INTO sources (folder_id, name, url) VALUES (?, ?, ?) RETURNING id",
                    (folder_id, name, url),
                ).fetchone()[0]
            except sqlite3.IntegrityError:
                raise AlreadyExists(f"{url} is already a Source") from None
            return _status_of(connection, source_id)

    def update_source(
        self, source_id: int, *, folder_id: int | None = None, paused: bool | None = None
    ) -> SourceStatus:
        with self._database.connection() as connection:
            current = _status_of(connection, source_id)
            if folder_id is not None:
                _require_folder(connection, folder_id)
            connection.execute(
                "UPDATE sources SET folder_id = ?, paused = ? WHERE id = ?",
                (
                    current.folder_id if folder_id is None else folder_id,
                    current.paused if paused is None else paused,
                    source_id,
                ),
            )
            return _status_of(connection, source_id)

    def delete_source(self, source_id: int) -> None:
        # The items table cascades, so the Source's Items leave the Inbox with it.
        with self._database.connection() as connection:
            if not connection.execute("DELETE FROM sources WHERE id = ?", (source_id,)).rowcount:
                raise NotFound(f"there is no Source {source_id}")

    def newsletter_source(self, *, folder_name: str, name: str, url: str) -> int:
        with self._database.connection() as connection:
            existing = connection.execute("SELECT id FROM sources WHERE url = ?", (url,)).fetchone()
            if existing:
                return int(existing[0])
            folder_id = connection.execute(
                "INSERT INTO folders (name, position) "
                "SELECT ?, COALESCE(MAX(position), 0) + 1 FROM folders WHERE true "
                "ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id",
                (folder_name,),
            ).fetchone()[0]
            source_id: int = connection.execute(
                "INSERT INTO sources (folder_id, name, url) VALUES (?, ?, ?) RETURNING id",
                (folder_id, name, url),
            ).fetchone()[0]
        return source_id

    def due(self, now: datetime) -> list[Source]:
        # Newsletter Sources (mailto:) arrive through the mailbox; there is nothing to fetch.
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT id, folder_id, name, url, etag, last_modified FROM sources "
                "WHERE NOT paused AND url NOT LIKE 'mailto:%' "
                "AND (next_fetch_at IS NULL OR next_fetch_at <= ?) "
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


_STATUS_COLUMNS = (
    "sources.id, sources.folder_id, sources.name, sources.url, sources.paused, "
    "sources.last_success_at, sources.last_error_at, sources.last_error"
)


type _StatusRow = tuple[int, int, str, str, int, str | None, str | None, str | None]


def _status(row: _StatusRow) -> SourceStatus:
    source_id, folder_id, name, url, paused, success_at, error_at, error = row
    return SourceStatus(
        id=source_id,
        folder_id=folder_id,
        name=name,
        url=url,
        paused=bool(paused),
        last_success_at=from_db_time(success_at) if success_at else None,
        last_error_at=from_db_time(error_at) if error_at else None,
        last_error=error,
    )


def _status_of(connection: sqlite3.Connection, source_id: int) -> SourceStatus:
    row = connection.execute(
        f"SELECT {_STATUS_COLUMNS} FROM sources WHERE id = ?", (source_id,)
    ).fetchone()
    if row is None:
        raise NotFound(f"there is no Source {source_id}")
    return _status(row)


def _require_folder(connection: sqlite3.Connection, folder_id: int) -> None:
    if connection.execute("SELECT 1 FROM folders WHERE id = ?", (folder_id,)).fetchone() is None:
        raise NotFound(f"there is no Folder {folder_id}")
