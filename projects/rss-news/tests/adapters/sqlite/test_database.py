import sqlite3
from pathlib import Path

import pytest

from rss_news.adapters.sqlite.database import MIGRATIONS, DatabaseError, SqliteDatabase


def test_migrate_creates_the_file_and_its_folder(tmp_path: Path) -> None:
    database = SqliteDatabase(tmp_path / "data" / "rss-news.sqlite3")

    database.migrate()

    assert database.path.is_file()
    assert database.is_reachable()


def test_a_file_from_a_later_release_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "rss-news.sqlite3"
    with sqlite3.connect(path) as connection:
        connection.execute(f"PRAGMA user_version = {len(MIGRATIONS) + 1}")
    connection.close()

    with pytest.raises(DatabaseError, match="newer than this code knows"):
        SqliteDatabase(path).migrate()


def test_a_file_that_is_not_a_database_is_unreachable(tmp_path: Path) -> None:
    path = tmp_path / "rss-news.sqlite3"
    path.write_bytes(b"not a database, just some bytes that are long enough" * 20)

    assert not SqliteDatabase(path).is_reachable()
