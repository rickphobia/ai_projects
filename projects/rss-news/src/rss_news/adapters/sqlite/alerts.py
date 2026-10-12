"""Push subscriptions in SQLite: the browsers that have Alerts turned on."""

from datetime import datetime

from rss_news.adapters.sqlite.database import SqliteDatabase, to_db_time
from rss_news.alerts.push import PushSubscription


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
