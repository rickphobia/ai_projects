"""Notes over the JSON API: list, save, change the comment, delete, and export as Markdown."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from rss_news.notes.notes import (
    LONGEST_COMMENT,
    LONGEST_ORIGIN,
    LONGEST_TEXT,
    NewNote,
    Note,
    NoteNotFound,
    Notes,
    NoteSource,
    SourceKind,
)

notes_router = APIRouter(prefix="/api/notes")


class SourceBody(BaseModel):
    kind: SourceKind
    id: int
    title: str = Field(min_length=1, max_length=LONGEST_ORIGIN)


class NewNoteBody(BaseModel):
    text: str = Field(min_length=1, max_length=LONGEST_TEXT)
    comment: str = Field(default="", max_length=LONGEST_COMMENT)
    source: SourceBody


class CommentBody(BaseModel):
    comment: str = Field(max_length=LONGEST_COMMENT)


def notes_of(request: Request) -> Notes:
    notes: Notes = request.app.state.notes
    return notes


def note_json(note: Note) -> dict[str, Any]:
    return {
        "id": note.id,
        "created_at": note.created_at.isoformat(),
        "text": note.text,
        "comment": note.comment,
        "source": {
            "kind": note.source.kind.value,
            "id": note.source.id,
            "title": note.source.title,
            "exists": note.source_exists,
        },
    }


@notes_router.get("")
def list_notes(request: Request) -> dict[str, Any]:
    """Every Note, newest first."""
    return {"notes": [note_json(note) for note in notes_of(request).newest_first()]}


@notes_router.post("", status_code=201)
def save_note(request: Request, body: NewNoteBody) -> dict[str, Any]:
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Select some text first.")
    note = NewNote(
        text=body.text.strip(),
        comment=body.comment.strip(),
        source=NoteSource(body.source.kind, body.source.id, body.source.title),
    )
    return note_json(notes_of(request).save(note))


@notes_router.get("/export")
def export_notes(request: Request) -> PlainTextResponse:
    """Every Note as one Markdown file."""
    return PlainTextResponse(
        notes_of(request).as_markdown(),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="notes.md"'},
    )


@notes_router.patch("/{note_id}")
def change_comment(request: Request, note_id: int, body: CommentBody) -> dict[str, Any]:
    try:
        return note_json(notes_of(request).change_comment(note_id, body.comment.strip()))
    except NoteNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None


@notes_router.delete("/{note_id}", status_code=204)
def delete_note(request: Request, note_id: int) -> None:
    try:
        notes_of(request).delete(note_id)
    except NoteNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from None
