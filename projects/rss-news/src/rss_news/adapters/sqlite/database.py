"""The SQLite database file: opening connections and applying schema migrations."""

import logging
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Each entry moves the schema one version up; PRAGMA user_version records how far a file got.
# Append new migrations; never edit one that has shipped.
MIGRATIONS: tuple[str, ...] = (
    """
    CREATE TABLE login_failures (
        id INTEGER PRIMARY KEY,
        failed_at TEXT NOT NULL  -- UTC, ISO 8601
    );
    CREATE INDEX login_failures_failed_at ON login_failures (failed_at);
    """,
    """
    CREATE TABLE folders (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        position INTEGER NOT NULL
    );
    CREATE TABLE sources (
        id INTEGER PRIMARY KEY,
        folder_id INTEGER NOT NULL REFERENCES folders (id),
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        etag TEXT,
        last_modified TEXT,
        next_fetch_at TEXT,  -- UTC, ISO 8601; NULL until the first fetch
        last_success_at TEXT,
        last_error_at TEXT,
        last_error TEXT
    );
    CREATE INDEX sources_next_fetch_at ON sources (next_fetch_at);
    CREATE TABLE items (
        id INTEGER PRIMARY KEY,
        source_id INTEGER NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        clean_url TEXT NOT NULL UNIQUE,
        excerpt TEXT NOT NULL,
        published_at TEXT NOT NULL,
        fetched_at TEXT NOT NULL
    );
    CREATE INDEX items_newest_first ON items (published_at DESC, id DESC);
    CREATE INDEX items_source ON items (source_id);
    -- One row per thing done once in the life of the database, such as loading the starter
    -- Sources.
    CREATE TABLE done_once (
        name TEXT PRIMARY KEY,
        done_at TEXT NOT NULL
    );
    """,
    """
    ALTER TABLE sources ADD COLUMN paused INTEGER NOT NULL DEFAULT 0;
    """,
)


class DatabaseError(Exception):
    """The database file can't be opened or migrated."""


class SqliteDatabase:
    def __init__(self, path: Path) -> None:
        self.path = path

    def migrate(self) -> None:
        """Create the file if needed and bring its schema up to the latest version."""
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.connection() as connection:
                current = connection.execute("PRAGMA user_version").fetchone()[0]
                if current > len(MIGRATIONS):
                    raise DatabaseError(
                        f"{self.path} has schema version {current}, newer than this code "
                        f"knows ({len(MIGRATIONS)}); was it written by a later release?"
                    )
                for version in range(current + 1, len(MIGRATIONS) + 1):
                    # executescript commits any open transaction first, so wrap each
                    # migration and its version bump in one explicit transaction.
                    connection.executescript(
                        f"BEGIN; {MIGRATIONS[version - 1]} PRAGMA user_version = {version}; COMMIT;"
                    )
                    logger.info("database migrated", extra={"schema_version": version})
        except (OSError, sqlite3.Error) as error:
            raise DatabaseError(f"can't open or migrate {self.path}: {error}") from error

    def is_reachable(self) -> bool:
        """True when the file opens and answers a query; for /healthz."""
        try:
            with self.connection() as connection:
                connection.execute("SELECT 1").fetchone()
        except sqlite3.Error:
            logger.warning("database unreachable", exc_info=True, extra={"path": str(self.path)})
            return False
        return True

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path)
        try:
            connection.execute("PRAGMA foreign_keys = ON")
            yield connection
            connection.commit()
        finally:
            connection.close()


def to_db_time(moment: datetime) -> str:
    """One fixed-width UTC form, so comparing the text in SQL compares the times."""
    if moment.utcoffset() is None:
        raise ValueError("times stored in the database must be timezone-aware")
    return moment.astimezone(UTC).isoformat(timespec="microseconds")


def from_db_time(text: str) -> datetime:
    return datetime.fromisoformat(text)
