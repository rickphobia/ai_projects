"""Items in SQLite: storing each clean URL once, the Inbox query, read state and scores."""

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from rss_news.adapters.sqlite.database import SqliteDatabase, from_db_time, to_db_time
from rss_news.clock import Clock
from rss_news.items.inbox import InboxItem, InboxOrder, InboxPosition, NewItem
from rss_news.scoring.item_scoring import ItemScore, UnscoredItem

_INBOX_SELECT = (
    "SELECT items.id, items.title, items.url, sources.name, folders.id, folders.name, "
    "items.published_at, items.importance, items.summary, items.read_at IS NOT NULL "
    "FROM items JOIN sources ON sources.id = items.source_id "
    "JOIN folders ON folders.id = sources.folder_id"
)


def _inbox_item(row: tuple[Any, ...]) -> InboxItem:
    return InboxItem(
        id=row[0],
        title=row[1],
        url=row[2],
        source_name=row[3],
        folder_id=row[4],
        folder_name=row[5],
        published_at=from_db_time(row[6]),
        importance=row[7],
        summary=row[8],
        read=bool(row[9]),
    )


class SqliteItems:
    def __init__(self, database: SqliteDatabase, clock: Clock) -> None:
        self._database = database
        self._clock = clock

    def add_new(self, items: Sequence[NewItem]) -> int:
        fetched_at = to_db_time(self._clock.now())
        with self._database.connection() as connection:
            before = connection.total_changes
            connection.executemany(
                "INSERT INTO items "
                "(source_id, title, url, clean_url, excerpt, published_at, fetched_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (clean_url) DO NOTHING",
                [
                    (
                        item.source_id,
                        item.title,
                        item.url,
                        item.clean_url,
                        item.excerpt,
                        to_db_time(item.published_at),
                        fetched_at,
                    )
                    for item in items
                ],
            )
            return connection.total_changes - before

    def listed(
        self,
        *,
        order: InboxOrder,
        folder_id: int | None,
        min_importance: int | None,
        search: str | None,
        after: InboxPosition | None,
        limit: int,
    ) -> list[InboxItem]:
        conditions: list[str] = []
        parameters: list[object] = []
        if search is not None:
            conditions.append(
                "items.id IN (SELECT rowid FROM items_search WHERE items_search MATCH ?)"
            )
            parameters.append(_match_expression(search))
        if folder_id is not None:
            conditions.append("sources.folder_id = ?")
            parameters.append(folder_id)
        if min_importance is not None:
            conditions.append("items.importance >= ?")
            parameters.append(min_importance)
        columns = ["items.published_at", "items.id"]
        if order is InboxOrder.IMPORTANCE:
            columns.insert(0, "COALESCE(items.importance, 0)")
        if after is not None:
            placeholders = ", ".join("?" for _ in columns)
            conditions.append(f"({', '.join(columns)}) < ({placeholders})")
            if order is InboxOrder.IMPORTANCE:
                parameters.append(after.importance or 0)
            parameters.extend([to_db_time(after.published_at), after.item_id])
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        descending = ", ".join(f"{column} DESC" for column in columns)
        with self._database.connection() as connection:
            rows = connection.execute(
                f"{_INBOX_SELECT} {where} ORDER BY {descending} LIMIT ?",
                [*parameters, limit],
            ).fetchall()
        return [_inbox_item(row) for row in rows]

    def delete_fetched_before(self, cutoff: datetime) -> int:
        with self._database.connection() as connection:
            return connection.execute(
                "DELETE FROM items WHERE fetched_at < ?", (to_db_time(cutoff),)
            ).rowcount

    def item(self, item_id: int) -> InboxItem | None:
        with self._database.connection() as connection:
            row = connection.execute(f"{_INBOX_SELECT} WHERE items.id = ?", (item_id,)).fetchone()
        return None if row is None else _inbox_item(row)

    def mark_read(self, item_id: int, *, at: datetime) -> None:
        with self._database.connection() as connection:
            connection.execute(
                "UPDATE items SET read_at = ? WHERE id = ? AND read_at IS NULL",
                (to_db_time(at), item_id),
            )

    def unscored(self, *, due_at: datetime, limit: int) -> list[UnscoredItem]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT items.id, items.title, items.excerpt, sources.name, items.score_failures "
                "FROM items JOIN sources ON sources.id = items.source_id "
                "WHERE items.scored_at IS NULL "
                "AND (items.score_retry_at IS NULL OR items.score_retry_at <= ?) "
                "ORDER BY items.score_failures, items.published_at DESC LIMIT ?",
                (to_db_time(due_at), limit),
            ).fetchall()
        return [UnscoredItem(*row) for row in rows]

    def save_scores(self, scores: Sequence[ItemScore], *, at: datetime) -> None:
        with self._database.connection() as connection:
            connection.executemany(
                "UPDATE items SET importance = ?, summary = ?, scored_at = ?, "
                "score_retry_at = NULL WHERE id = ?",
                [
                    (score.importance, score.summary, to_db_time(at), score.item_id)
                    for score in scores
                ],
            )

    def record_failures(self, failures: Sequence[tuple[int, datetime]]) -> None:
        with self._database.connection() as connection:
            connection.executemany(
                "UPDATE items SET score_failures = score_failures + 1, score_retry_at = ? "
                "WHERE id = ?",
                [(to_db_time(retry_at), item_id) for item_id, retry_at in failures],
            )


def _match_expression(search: str) -> str:
    """Each word as a quoted FTS prefix term, so every word must match the start of a word and
    the owner's quotes, dashes or stars can't be read as FTS syntax."""
    words = search.split()
    return " ".join('"' + word.replace('"', '""') + '"*' for word in words)
