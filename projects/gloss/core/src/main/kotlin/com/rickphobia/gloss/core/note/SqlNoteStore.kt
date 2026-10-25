package com.rickphobia.gloss.core.note

import com.rickphobia.gloss.core.storage.GlossDatabase
import java.time.Instant

/** Notes in the app's SQLite database. The calls block, so the caller runs them off the main thread. */
class SqlNoteStore(
    private val database: GlossDatabase,
) : NoteStore {
    override suspend fun save(note: Note): Long =
        database.noteQueries.transactionWithResult {
            database.noteQueries.insert(
                note.selection,
                note.text,
                note.writtenAt.toEpochMilli(),
                note.book?.book,
                note.book?.author,
                note.book?.chapter,
                note.lookupId,
            )
            database.noteQueries.lastId().executeAsOne()
        }

    override suspend fun all(): List<Note> =
        database.noteQueries
            .all { selection, text, writtenAt, book, author, chapter, lookupId ->
                Note(
                    selection,
                    text,
                    Instant.ofEpochMilli(writtenAt),
                    book?.let { NoteBook(it, author.orEmpty(), chapter.orEmpty()) },
                    lookupId,
                )
            }.executeAsList()
}
