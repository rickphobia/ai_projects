"""Chats in SQLite: the Items `search_items` finds, and saved Chats with their messages."""

import json
from collections.abc import Sequence
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from rss_news.adapters.sqlite.database import (
    DatabaseError,
    SqliteDatabase,
    from_db_time,
    to_db_time,
)
from rss_news.adapters.sqlite.items import match_expression
from rss_news.chat.conversation import (
    AnswerItem,
    Chat,
    ChatMessage,
    ChatSummary,
    FoundItem,
)

_MICRO = Decimal("0.000001")
# Long enough to recognise a Chat in the list.
_TITLE_CHARACTERS = 80
_UNTITLED = "New Chat"
_FOUND_FROM = (
    "FROM items JOIN sources ON sources.id = items.source_id "
    "JOIN folders ON folders.id = sources.folder_id"
)
_FOUND_COLUMNS = (
    "items.id, items.title, sources.name, folders.name, items.published_at, items.importance, "
    "items.summary"
)
_CHAT_SELECT = "SELECT id, title, created_at, updated_at, cost_micro_usd FROM chats"


class SqliteChats:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def folders(self) -> list[tuple[int, str]]:
        with self._database.connection() as connection:
            rows = connection.execute(
                "SELECT id, name FROM folders ORDER BY position, id"
            ).fetchall()
        return [(row[0], row[1]) for row in rows]

    def find_items(
        self,
        *,
        since: datetime,
        folder_id: int | None,
        keyword: str | None,
        min_importance: int | None,
        limit: int,
    ) -> tuple[int, list[FoundItem]]:
        conditions = ["items.published_at >= ?"]
        parameters: list[str | int] = [to_db_time(since)]
        if folder_id is not None:
            conditions.append("folders.id = ?")
            parameters.append(folder_id)
        if keyword:
            conditions.append(
                "items.id IN (SELECT rowid FROM items_search WHERE items_search MATCH ?)"
            )
            parameters.append(match_expression(keyword))
        if min_importance is not None:
            conditions.append("items.importance >= ?")
            parameters.append(min_importance)
        where = " AND ".join(conditions)
        with self._database.connection() as connection:
            count = connection.execute(
                f"SELECT count(*) {_FOUND_FROM} WHERE {where}", parameters
            ).fetchone()[0]
            rows = connection.execute(
                f"SELECT {_FOUND_COLUMNS} {_FOUND_FROM} WHERE {where} "
                "ORDER BY COALESCE(items.importance, 0) DESC, items.published_at DESC, "
                "items.id DESC LIMIT ?",
                [*parameters, limit],
            ).fetchall()
        return count, [_found_item(row) for row in rows]

    def items_with_ids(self, item_ids: Sequence[int]) -> dict[int, FoundItem]:
        wanted = sorted(set(item_ids))
        if not wanted:
            return {}
        placeholders = ", ".join("?" * len(wanted))
        with self._database.connection() as connection:
            rows = connection.execute(
                f"SELECT {_FOUND_COLUMNS} {_FOUND_FROM} WHERE items.id IN ({placeholders})",
                wanted,
            ).fetchall()
        return {row[0]: _found_item(row) for row in rows}

    def create(self, *, created_at: datetime) -> ChatSummary:
        with self._database.connection() as connection:
            cursor = connection.execute(
                "INSERT INTO chats (created_at, updated_at) VALUES (?, ?)",
                (to_db_time(created_at), to_db_time(created_at)),
            )
            chat_id = cursor.lastrowid
        if chat_id is None:
            raise DatabaseError("saving a Chat gave no row id")
        return ChatSummary(chat_id, _UNTITLED, created_at, created_at, Decimal(0))

    def all_newest_first(self) -> list[ChatSummary]:
        with self._database.connection() as connection:
            rows = connection.execute(f"{_CHAT_SELECT} ORDER BY updated_at DESC, id DESC")
            return [_summary(row) for row in rows.fetchall()]

    def get(self, chat_id: int) -> Chat | None:
        with self._database.connection() as connection:
            row = connection.execute(
                "SELECT id, title, created_at, updated_at, cost_micro_usd, context FROM chats "
                "WHERE id = ?",
                (chat_id,),
            ).fetchone()
            if row is None:
                return None
            messages = connection.execute(
                "SELECT id, created_at, role, text, items FROM chat_messages "
                "WHERE chat_id = ? ORDER BY id",
                (chat_id,),
            ).fetchall()
        return Chat(_summary(row), [_message(message) for message in messages], row[5])

    def add_turn(
        self,
        chat_id: int,
        *,
        question: str,
        answer_intro: str,
        answer_items: Sequence[AnswerItem],
        context: str,
        cost_usd: Decimal,
        at: datetime,
    ) -> ChatMessage:
        micro_usd = int(cost_usd.quantize(_MICRO, rounding=ROUND_HALF_UP) / _MICRO)
        moment = to_db_time(at)
        items_json = json.dumps(
            [
                {
                    "id": item.id,
                    "title": item.title,
                    "source": item.source_name,
                    "summary": item.summary,
                    "importance": item.importance,
                    "published_at": None
                    if item.published_at is None
                    else to_db_time(item.published_at),
                }
                for item in answer_items
            ],
            ensure_ascii=False,
        )
        title = " ".join(question.split())[:_TITLE_CHARACTERS]
        # One transaction: a question is never saved without its answer.
        with self._database.connection() as connection:
            connection.execute(
                "INSERT INTO chat_messages (chat_id, created_at, role, text) "
                "VALUES (?, ?, 'owner', ?)",
                (chat_id, moment, question),
            )
            cursor = connection.execute(
                "INSERT INTO chat_messages (chat_id, created_at, role, text, items) "
                "VALUES (?, ?, 'assistant', ?, ?)",
                (chat_id, moment, answer_intro, items_json),
            )
            connection.execute(
                "UPDATE chats SET title = COALESCE(title, ?), updated_at = ?, context = ?, "
                "cost_micro_usd = cost_micro_usd + ? WHERE id = ?",
                (title, moment, context, micro_usd, chat_id),
            )
            answer_id = cursor.lastrowid
        if answer_id is None:
            raise DatabaseError("saving a Chat answer gave no row id")
        return ChatMessage(answer_id, at, "assistant", answer_intro, list(answer_items))


def _found_item(row: tuple[Any, ...]) -> FoundItem:
    return FoundItem(
        id=row[0],
        title=row[1],
        source_name=row[2],
        folder_name=row[3],
        published_at=from_db_time(row[4]),
        importance=row[5],
        summary=row[6],
    )


def _summary(row: tuple[Any, ...]) -> ChatSummary:
    return ChatSummary(
        id=row[0],
        title=row[1] or _UNTITLED,
        created_at=from_db_time(row[2]),
        updated_at=from_db_time(row[3]),
        cost_usd=Decimal(row[4]) * _MICRO,
    )


def _message(row: tuple[Any, ...]) -> ChatMessage:
    return ChatMessage(
        id=row[0],
        created_at=from_db_time(row[1]),
        role=row[2],
        text=row[3],
        items=[_answer_item(item) for item in json.loads(row[4])],
    )


def _answer_item(saved: dict[str, Any]) -> AnswerItem:
    published_at = saved.get("published_at")
    return AnswerItem(
        saved["id"],
        saved["title"],
        saved["source"],
        saved["summary"],
        importance=saved.get("importance"),
        published_at=None if published_at is None else from_db_time(published_at),
    )
