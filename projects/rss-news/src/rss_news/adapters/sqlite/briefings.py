"""Briefings in SQLite: the Items a Briefing reads, and saved Briefings."""

import json
from collections.abc import Iterable, Sequence
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from rss_news.adapters.sqlite.database import (
    DatabaseError,
    SqliteDatabase,
    from_db_time,
    to_db_time,
)
from rss_news.briefings.briefing import (
    Briefing,
    BriefingItem,
    BriefingPoint,
    BriefingSection,
    PointItem,
)

_MICRO = Decimal("0.000001")
_BRIEFING_SELECT = (
    "SELECT id, scope, created_at, item_count, cost_micro_usd, sections FROM briefings"
)


class SqliteBriefings:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def items_since(
        self, since: datetime, *, folder_id: int | None, min_importance: int | None
    ) -> list[BriefingItem]:
        conditions = ["items.published_at >= ?"]
        parameters: list[str | int] = [to_db_time(since)]
        if folder_id is not None:
            conditions.append("folders.id = ?")
            parameters.append(folder_id)
        if min_importance is not None:
            conditions.append("items.importance >= ?")
            parameters.append(min_importance)
        return self._items(" AND ".join(conditions), parameters)

    def items_with_ids(self, item_ids: Iterable[int]) -> list[BriefingItem]:
        wanted = sorted(set(item_ids))
        if not wanted:
            return []
        placeholders = ", ".join("?" * len(wanted))
        return self._items(f"items.id IN ({placeholders})", list(wanted))

    def _items(self, where: str, parameters: Sequence[str | int]) -> list[BriefingItem]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT items.id, items.title, items.url, sources.name, folders.id, "
                "folders.name, items.published_at, items.importance, items.summary, "
                "items.excerpt "
                "FROM items JOIN sources ON sources.id = items.source_id "
                "JOIN folders ON folders.id = sources.folder_id "
                f"WHERE {where} "
                "ORDER BY folders.position, folders.id, items.published_at DESC, items.id DESC",
                parameters,
            ).fetchall()
        return [
            BriefingItem(
                id=row[0],
                title=row[1],
                url=row[2],
                source_name=row[3],
                folder_id=row[4],
                folder_name=row[5],
                published_at=from_db_time(row[6]),
                importance=row[7],
                summary=row[8],
                excerpt=row[9],
            )
            for row in rows
        ]

    def add(
        self,
        *,
        scope_key: str,
        created_at: datetime,
        local_day: date,
        item_count: int,
        cost_usd: Decimal,
        sections: Sequence[BriefingSection],
    ) -> Briefing:
        micro_usd = int(cost_usd.quantize(_MICRO, rounding=ROUND_HALF_UP) / _MICRO)
        with self._database.connection() as connection:
            cursor = connection.execute(
                "INSERT INTO briefings "
                "(scope, created_at, local_day, item_count, cost_micro_usd, sections) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    scope_key,
                    to_db_time(created_at),
                    local_day.isoformat(),
                    item_count,
                    micro_usd,
                    json.dumps([_section_json(section) for section in sections]),
                ),
            )
            briefing_id = cursor.lastrowid
        if briefing_id is None:
            raise DatabaseError("saving a Briefing gave no row id")
        return Briefing(
            briefing_id, scope_key, created_at, item_count, micro_usd * _MICRO, list(sections)
        )

    def latest(self) -> Briefing | None:
        with self._database.connection() as connection:
            row = connection.execute(f"{_BRIEFING_SELECT} ORDER BY id DESC LIMIT 1").fetchone()
        return None if row is None else _briefing(row)

    def all_newest_first(self) -> list[Briefing]:
        with self._database.connection() as connection:
            rows = connection.execute(f"{_BRIEFING_SELECT} ORDER BY id DESC").fetchall()
        return [_briefing(row) for row in rows]

    def get(self, briefing_id: int) -> Briefing | None:
        with self._database.connection() as connection:
            row = connection.execute(f"{_BRIEFING_SELECT} WHERE id = ?", (briefing_id,)).fetchone()
        return None if row is None else _briefing(row)

    def latest_on(self, scope_key: str, local_day: date) -> Briefing | None:
        with self._database.connection() as connection:
            row = connection.execute(
                f"{_BRIEFING_SELECT} WHERE scope = ? AND local_day = ? ORDER BY id DESC LIMIT 1",
                (scope_key, local_day.isoformat()),
            ).fetchone()
        return None if row is None else _briefing(row)


def _section_json(section: BriefingSection) -> dict[str, Any]:
    return {
        "folder_id": section.folder_id,
        "folder_name": section.folder_name,
        "points": [
            {
                "text": point.text,
                "items": [
                    {"id": item.id, "title": item.title, "source": item.source_name}
                    for item in point.items
                ],
            }
            for point in section.points
        ],
    }


def _briefing(row: tuple[Any, ...]) -> Briefing:
    sections = [
        BriefingSection(
            folder_id=section["folder_id"],
            folder_name=section["folder_name"],
            points=[
                BriefingPoint(
                    point["text"],
                    [
                        PointItem(item["id"], item["title"], item["source"])
                        for item in point["items"]
                    ],
                )
                for point in section["points"]
            ],
        )
        for section in json.loads(row[5])
    ]
    return Briefing(
        id=row[0],
        scope_key=row[1],
        created_at=from_db_time(row[2]),
        item_count=row[3],
        cost_usd=Decimal(row[4]) * _MICRO,
        sections=sections,
    )
