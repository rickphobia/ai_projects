"""Notes in SQLite."""

from datetime import datetime

from rss_news.adapters.sqlite.database import SqliteDatabase, from_db_time, to_db_time
from rss_news.notes.notes import NewNote, Note, NoteSource, SourceKind

# The last column says whether the Note's Briefing, Item or Chat is still there.
_NOTE_SELECT = """
    SELECT id, created_at, text, comment, source_kind, source_id, source_title,
        CASE source_kind
            WHEN 'briefing' THEN EXISTS (SELECT 1 FROM briefings WHERE id = notes.source_id)
            WHEN 'item' THEN EXISTS (SELECT 1 FROM items WHERE id = notes.source_id)
            WHEN 'chat' THEN EXISTS (SELECT 1 FROM chats WHERE id = notes.source_id)
        END
    FROM notes
"""

type NoteRow = tuple[int, str, str, str, str, int, str, int]


class SqliteNotes:
    def __init__(self, database: SqliteDatabase) -> None:
        self._database = database

    def add(self, note: NewNote, at: datetime) -> Note:
        with self._database.connection() as connection:
            cursor = connection.execute(
                "INSERT INTO notes (created_at, text, comment, source_kind, source_id, "
                "source_title) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    to_db_time(at),
                    note.text,
                    note.comment,
                    note.source.kind.value,
                    note.source.id,
                    note.source.title,
                ),
            )
            row = connection.execute(f"{_NOTE_SELECT} WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return _note(row)

    def newest_first(self) -> list[Note]:
        with self._database.connection() as connection:
            rows = connection.execute(
                f"{_NOTE_SELECT} ORDER BY created_at DESC, id DESC"
            ).fetchall()
        return [_note(row) for row in rows]

    def set_comment(self, note_id: int, comment: str) -> Note | None:
        with self._database.connection() as connection:
            connection.execute("UPDATE notes SET comment = ? WHERE id = ?", (comment, note_id))
            row = connection.execute(f"{_NOTE_SELECT} WHERE id = ?", (note_id,)).fetchone()
        return None if row is None else _note(row)

    def delete(self, note_id: int) -> bool:
        with self._database.connection() as connection:
            return connection.execute("DELETE FROM notes WHERE id = ?", (note_id,)).rowcount > 0


def _note(row: NoteRow) -> Note:
    note_id, created_at, text, comment, kind, source_id, title, exists = row
    return Note(
        id=note_id,
        created_at=from_db_time(created_at),
        text=text,
        comment=comment,
        source=NoteSource(SourceKind(kind), source_id, title),
        source_exists=bool(exists),
    )
