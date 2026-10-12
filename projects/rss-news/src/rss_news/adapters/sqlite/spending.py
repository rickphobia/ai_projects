"""The spending ledger in SQLite: one row per AI call."""

from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from rss_news.adapters.sqlite.database import SqliteDatabase, from_db_time, to_db_time
from rss_news.spending.ledger import AiCall, AiUsage, Feature

_MICRO = Decimal("0.000001")


class SqliteSpending:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def add(self, call: AiCall) -> None:
        usage = call.usage
        micro_usd = int(call.cost_usd.quantize(_MICRO, rounding=ROUND_HALF_UP) / _MICRO)
        with self._database.connection() as connection:
            connection.execute(
                "INSERT INTO ai_calls (called_at, feature, model, input_tokens, output_tokens, "
                "web_searches, cost_micro_usd, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    to_db_time(call.called_at),
                    call.feature.value,
                    usage.model,
                    usage.input_tokens,
                    usage.output_tokens,
                    usage.web_searches,
                    micro_usd,
                    round(usage.duration.total_seconds() * 1000),
                ),
            )

    def calls(self) -> list[AiCall]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT called_at, feature, model, input_tokens, output_tokens, web_searches, "
                "cost_micro_usd, duration_ms FROM ai_calls ORDER BY id"
            ).fetchall()
        return [
            AiCall(
                called_at=from_db_time(row[0]),
                feature=Feature(row[1]),
                usage=AiUsage(
                    model=row[2],
                    input_tokens=row[3],
                    output_tokens=row[4],
                    web_searches=row[5],
                    duration=timedelta(milliseconds=row[7]),
                ),
                cost_usd=Decimal(row[6]) * _MICRO,
            )
            for row in rows
        ]
