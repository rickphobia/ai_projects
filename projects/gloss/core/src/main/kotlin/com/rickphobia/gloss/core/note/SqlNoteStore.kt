package com.rickphobia.gloss.core.note

import com.rickphobia.gloss.core.context.BookPlace
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
                note.book?.place?.bookUrl,
                note.book
                    ?.place
                    ?.chapterIndex
                    ?.toLong(),
                note.book
                    ?.place
                    ?.position
                    ?.toLong(),
                note.lookupId,
            )
            database.noteQueries.lastId().executeAsOne()
        }

    override suspend fun all(): List<Note> =
        database.noteQueries
            .all { selection, text, writtenAt, book, author, chapter, bookUrl, chapterIndex, position, lookupId ->
                val place = bookUrl?.let { BookPlace(it, chapterIndex?.toInt() ?: 0, position?.toInt() ?: 0) }
                Note(
                    selection,
                    text,
                    Instant.ofEpochMilli(writtenAt),
                    if (book != null &&
                        place != null
                    ) {
                        NoteBook(book, author.orEmpty(), chapter.orEmpty(), place)
                    } else {
                        null
                    },
                    lookupId,
                )
            }.executeAsList()
}
