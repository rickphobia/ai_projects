"""Alerts in SQLite: the browsers that have them turned on, and what the rules decided for each
scored Item."""

import json
from datetime import datetime

from rss_news.adapters.sqlite.database import SqliteDatabase, to_db_time
from rss_news.alerts.push import PushSubscription
from rss_news.alerts.rules import AlertOutcome, ScoredItem


class SqlitePushSubscriptions:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def save(self, subscription: PushSubscription, at: datetime) -> None:
        with self._database.connection() as connection:
            connection.execute(
                """
                INSERT INTO push_subscriptions (endpoint, p256dh, auth, subscribed_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (endpoint) DO UPDATE SET
                    p256dh = excluded.p256dh, auth = excluded.auth
                """,
                (subscription.endpoint, subscription.p256dh, subscription.auth, to_db_time(at)),
            )

    def remove(self, endpoint: str) -> None:
        with self._database.connection() as connection:
            connection.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))

    def all(self) -> list[PushSubscription]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT endpoint, p256dh, auth FROM push_subscriptions ORDER BY subscribed_at"
            ).fetchall()
        return [PushSubscription(endpoint, p256dh, auth) for endpoint, p256dh, auth in rows]


class SqliteAlertDecisions:
    """What the Alert rules decided for each scored Item, kept on the Item."""

    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def undecided(self) -> list[ScoredItem]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT id, title, summary, importance, stocks FROM items "
                "WHERE alert IS NULL AND scored_at IS NOT NULL ORDER BY scored_at, id"
            ).fetchall()
        return [
            ScoredItem(item_id, title, summary, importance, tuple(json.loads(stocks)))
            for item_id, title, summary, importance, stocks in rows
        ]

    def decide(self, item_id: int, outcome: AlertOutcome, *, at: datetime) -> None:
        with self._database.connection() as connection:
            connection.execute(
                "UPDATE items SET alert = ?, alert_decided_at = ? WHERE id = ?",
                (outcome.value, to_db_time(at), item_id),
            )

    def sent_since(self, moment: datetime) -> int:
        with self._database.connection() as connection:
            (count,) = connection.execute(
                "SELECT COUNT(*) FROM items WHERE alert = ? AND alert_decided_at >= ?",
                (AlertOutcome.SENT.value, to_db_time(moment)),
            ).fetchone()
        count_sent: int = count
        return count_sent
