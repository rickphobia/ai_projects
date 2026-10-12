"""Items in SQLite: storing each clean URL once, and the Inbox query."""

from collections.abc import Sequence

from rss_news.adapters.sqlite.database import SqliteDatabase, from_db_time, to_db_time
from rss_news.clock import Clock
from rss_news.items.inbox import InboxItem, InboxPosition, NewItem


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

    def newest_first(
        self, *, folder_id: int | None, after: InboxPosition | None, limit: int
    ) -> list[InboxItem]:
        conditions: list[str] = []
        parameters: list[object] = []
        if folder_id is not None:
            conditions.append("sources.folder_id = ?")
            parameters.append(folder_id)
        if after is not None:
            conditions.append("(items.published_at, items.id) < (?, ?)")
            parameters.extend([to_db_time(after.published_at), after.item_id])
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT items.id, items.title, items.url, sources.name, folders.id, "
                "folders.name, items.published_at FROM items "
                "JOIN sources ON sources.id = items.source_id "
                "JOIN folders ON folders.id = sources.folder_id "
                f"{where} ORDER BY items.published_at DESC, items.id DESC LIMIT ?",
                [*parameters, limit],
            ).fetchall()
        return [
            InboxItem(
                id=row[0],
                title=row[1],
                url=row[2],
                source_name=row[3],
                folder_id=row[4],
                folder_name=row[5],
                published_at=from_db_time(row[6]),
            )
            for row in rows
        ]
