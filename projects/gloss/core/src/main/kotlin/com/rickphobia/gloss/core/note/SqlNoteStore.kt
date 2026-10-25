package com.rickphobia.gloss.core.note

import com.rickphobia.gloss.core.Saved
import com.rickphobia.gloss.core.context.BookLocationColumns
import com.rickphobia.gloss.core.storage.GlossDatabase
import java.time.Instant

/** Notes in the app's SQLite database. The calls block, so the caller runs them off the main thread. */
class SqlNoteStore(
    private val database: GlossDatabase,
) : NoteStore {
    override suspend fun save(note: Note): Long =
        database.noteQueries.transactionWithResult {
            val place = note.book?.place
            database.noteQueries.insert(
                note.selection,
                note.text,
                note.writtenAt.toEpochMilli(),
                note.book?.book,
                note.book?.author,
                note.book?.chapter,
                place?.bookUrl,
                place?.chapterIndex?.toLong(),
                place?.position?.toLong(),
                note.lookupId,
            )
            database.noteQueries.lastId().executeAsOne()
        }

    override suspend fun all(): List<Saved<Note>> =
        database.noteQueries
            .all { id, selection, text, writtenAt, book, author, chapter, bookUrl, chapterIndex, position, lookupId ->
                val location =
                    BookLocationColumns.read(
                        book,
                        author,
                        chapter,
                        BookLocationColumns.place(bookUrl, chapterIndex, position),
                    )
                Saved(id, Note(selection, text, Instant.ofEpochMilli(writtenAt), location, lookupId))
            }.executeAsList()

    override suspend fun edit(
        id: Long,
        text: String,
    ) {
        database.noteQueries.updateText(text, id)
    }

    override suspend fun delete(id: Long) {
        database.noteQueries.delete(id)
    }
}
