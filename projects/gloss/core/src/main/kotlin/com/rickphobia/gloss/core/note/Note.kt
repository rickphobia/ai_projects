package com.rickphobia.gloss.core.note

import com.rickphobia.gloss.core.Saved
import com.rickphobia.gloss.core.context.BookLocation
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
    val book: BookLocation? = null,
    val lookupId: Long? = null,
)

/** The storage port for Notes. */
interface NoteStore {
    /** Saves [note] and returns its id. */
    suspend fun save(note: Note): Long

    /** Every Note with its id, oldest first. */
    suspend fun all(): List<Saved<Note>>

    /** Replaces the text of the Note [id]. */
    suspend fun edit(
        id: Long,
        text: String,
    )

    suspend fun delete(id: Long)
}
