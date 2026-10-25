package com.rickphobia.gloss.core.note

import com.rickphobia.gloss.core.context.BookContext
import java.time.Instant

/**
 * The owner's own words about a Selection, written without the AI. [book] is null for a Note made
 * without Book context, which goes under "No book". [lookupId] is set when the Note was written on
 * a Define or Explain card and belongs next to that Lookup.
 */
data class Note(
    val selection: String,
    val text: String,
    val writtenAt: Instant,
    val book: NoteBook? = null,
    val lookupId: Long? = null,
)

/** The book and chapter a Note was written in: its Book context without the passage. */
data class NoteBook(
    val book: String,
    val author: String,
    val chapter: String,
) {
    companion object {
        fun of(context: BookContext) = NoteBook(context.book, context.author, context.chapter)
    }
}

/** The storage port for Notes. */
interface NoteStore {
    /** Saves [note] and returns its id. */
    suspend fun save(note: Note): Long

    /** Every Note, oldest first. */
    suspend fun all(): List<Note>
}
