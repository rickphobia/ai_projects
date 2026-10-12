"""The Watchlist, Holdings and ticker-news Sources in SQLite."""

import sqlite3
from collections.abc import Sequence
from datetime import datetime

from rss_news.adapters.sqlite.database import SqliteDatabase, from_db_time, to_db_time
from rss_news.stocks.owner_stocks import AlreadyWatched, NotWatched, WatchedStock


class SqliteStocks:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def watchlist(self) -> list[WatchedStock]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT ticker, added_at FROM watchlist ORDER BY added_at, ticker"
            ).fetchall()
        return [WatchedStock(ticker=row[0], added_at=from_db_time(row[1])) for row in rows]

    def add_to_watchlist(self, ticker: str, at: datetime) -> WatchedStock:
        with self._database.connection() as connection:
            try:
                connection.execute(
                    "INSERT INTO watchlist (ticker, added_at) VALUES (?, ?)",
                    (ticker, to_db_time(at)),
                )
            except sqlite3.IntegrityError:
                raise AlreadyWatched(f"{ticker} is on the Watchlist already") from None
        return WatchedStock(ticker=ticker, added_at=at)

    def remove_from_watchlist(self, ticker: str) -> None:
        with self._database.connection() as connection:
            if not connection.execute("DELETE FROM watchlist WHERE ticker = ?", (ticker,)).rowcount:
                raise NotWatched(f"{ticker} isn't on the Watchlist")

    def holdings(self) -> list[str]:
        with self._database.connection() as connection:
            rows = connection.execute("SELECT ticker FROM holdings ORDER BY ticker").fetchall()
        return [row[0] for row in rows]

    def replace_holdings(self, tickers: Sequence[str]) -> None:
        with self._database.connection() as connection:
            connection.execute("DELETE FROM holdings")
            connection.executemany(
                "INSERT INTO holdings (ticker) VALUES (?)", [(ticker,) for ticker in tickers]
            )

    def ticker_sources(self) -> dict[str, int]:
        with self._database.connection() as connection:
            rows = connection.execute("SELECT ticker, source_id FROM ticker_sources").fetchall()
        return {row[0]: row[1] for row in rows}

    def add_ticker_source(self, ticker: str, *, folder_name: str, name: str, url: str) -> int:
        with self._database.connection() as connection:
            folder_id = connection.execute(
                "INSERT INTO folders (name, position) "
                "SELECT ?, COALESCE(MAX(position), 0) + 1 FROM folders WHERE true "
                "ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id",
                (folder_name,),
            ).fetchone()[0]
            # A Source the owner added with the same URL becomes the ticker's, wherever it is.
            source_id: int = connection.execute(
                "INSERT INTO sources (folder_id, name, url) VALUES (?, ?, ?) "
                "ON CONFLICT (url) DO UPDATE SET url = excluded.url RETURNING id",
                (folder_id, name, url),
            ).fetchone()[0]
            connection.execute(
                "INSERT INTO ticker_sources (ticker, source_id) VALUES (?, ?)",
                (ticker, source_id),
            )
        return source_id

    def remove_ticker_source(self, ticker: str) -> None:
        # Deleting the Source cascades to its Items and its ticker_sources row.
        with self._database.connection() as connection:
            connection.execute(
                "DELETE FROM sources WHERE id = "
                "(SELECT source_id FROM ticker_sources WHERE ticker = ?)",
                (ticker,),
            )
