"""Notes: text the owner selected and saved, with an optional comment and a link back to the
Briefing, Item or Chat it came from."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol

from rss_news.clock import Clock

# The longest selection, comment and origin a Note keeps; the selection popup sends no more.
LONGEST_TEXT = 4000
LONGEST_COMMENT = 2000
LONGEST_ORIGIN = 300


class SourceKind(StrEnum):
    BRIEFING = "briefing"
    ITEM = "item"
    CHAT = "chat"


@dataclass(frozen=True)
class NoteSource:
    kind: SourceKind
    id: int
    # Where it was selected, such as "Item: Ringgit rises (Reuters)". Copied in, so the link
    # back still says what it was after old-Item cleanup deletes the Item.
    title: str


@dataclass(frozen=True)
class NewNote:
    text: str
    comment: str
    source: NoteSource


@dataclass(frozen=True)
class Note:
    id: int
    created_at: datetime
    text: str
    comment: str
    source: NoteSource
    # False once the Briefing, Item or Chat is deleted.
    source_exists: bool


class NoteNotFound(Exception):
    """No Note has this id."""


class NoteStore(Protocol):
    def add(self, note: NewNote, at: datetime) -> Note: ...

    def newest_first(self) -> list[Note]: ...

    def set_comment(self, note_id: int, comment: str) -> Note | None:
        """The changed Note, or None when there is no such Note."""
        ...

    def delete(self, note_id: int) -> bool:
        """True when a Note was deleted."""
        ...


class Notes:
    def __init__(self, store: NoteStore, clock: Clock) -> None:
        self._store = store
        self._clock = clock

    def save(self, note: NewNote) -> Note:
        return self._store.add(note, self._clock.now())

    def newest_first(self) -> list[Note]:
        return self._store.newest_first()

    def change_comment(self, note_id: int, comment: str) -> Note:
        changed = self._store.set_comment(note_id, comment)
        if changed is None:
            raise NoteNotFound(f"no Note has id {note_id}")
        return changed

    def delete(self, note_id: int) -> None:
        if not self._store.delete(note_id):
            raise NoteNotFound(f"no Note has id {note_id}")

    def as_markdown(self) -> str:
        return notes_as_markdown(self._store.newest_first())


def notes_as_markdown(notes: Sequence[Note]) -> str:
    """Every Note as a quote, its comment and where it came from, newest first."""
    parts = ["# Notes\n"]
    for note in notes:
        quoted = "\n".join(f"> {line}".rstrip() for line in note.text.splitlines())
        parts.append(f"\n{quoted}\n")
        if note.comment:
            parts.append(f"\n{note.comment}\n")
        gone = "" if note.source_exists else f" (the {note.source.kind.value} is gone)"
        saved = note.created_at.date().isoformat()
        parts.append(f"\n— {note.source.title}{gone}, saved {saved}\n")
    return "".join(parts)
