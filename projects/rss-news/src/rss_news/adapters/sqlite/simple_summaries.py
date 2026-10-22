"""Saved Simple summaries in SQLite, one per Item."""

import json
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from rss_news.adapters.sqlite.database import SqliteDatabase, to_db_time
from rss_news.simple_summaries.summarising import SimpleSummary

_MICRO = Decimal("0.000001")


class SqliteSimpleSummaries:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def get(self, item_id: int) -> SimpleSummary | None:
        with self._database.connection() as connection:
            row = connection.execute(
                "SELECT gist, points, from_preview, cost_micro_usd FROM simple_summaries "
                "WHERE item_id = ?",
                (item_id,),
            ).fetchone()
        if row is None:
            return None
        gist, points, from_preview, micro_usd = row
        return SimpleSummary(
            gist, json.loads(points), from_preview=bool(from_preview), cost_usd=micro_usd * _MICRO
        )

    def save(self, item_id: int, summary: SimpleSummary, at: datetime) -> None:
        micro_usd = int(summary.cost_usd.quantize(_MICRO, rounding=ROUND_HALF_UP) / _MICRO)
        with self._database.connection() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO simple_summaries "
                "(item_id, created_at, gist, points, from_preview, cost_micro_usd) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    item_id,
                    to_db_time(at),
                    summary.gist,
                    json.dumps(summary.points, ensure_ascii=False),
                    int(summary.from_preview),
                    micro_usd,
                ),
            )
