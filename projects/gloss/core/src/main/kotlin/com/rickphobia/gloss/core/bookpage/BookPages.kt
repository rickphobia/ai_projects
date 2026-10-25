package com.rickphobia.gloss.core.bookpage

import com.rickphobia.gloss.core.context.BookLocation
import com.rickphobia.gloss.core.lookup.Lookup
import com.rickphobia.gloss.core.lookup.LookupStore
import com.rickphobia.gloss.core.note.Note
import com.rickphobia.gloss.core.note.NoteStore
import java.time.Instant

/**
 * Everything Gloss holds, by book: the Books screen, each Book page, Recent, and editing and
 * deleting. Books are told apart by Legado's book URL; a Lookup or Note made without Book context
 * is under "No book" (a null URL). A Note written on a Lookup's card sits with that Lookup.
 */
class BookPages(
    private val lookups: LookupStore,
    private val notes: NoteStore,
) {
    /** Every book with a Lookup or Note, and "No book" if anything is under it, most recent first. */
    suspend fun books(): List<BookSummary> =
        pageEntries()
            .groupBy { it.bookUrl }
            .map { (bookUrl, entries) ->
                val newest = entries.maxBy { it.lastAt }
                BookSummary(bookUrl, newest.book?.book, newest.book?.author, newest.lastAt)
            }.sortedByDescending { it.lastAt }

    /**
     * The Book page of [bookUrl] (null for "No book"): its Lookups and Notes by chapter, then by
     * position in the chapter, oldest first where those are equal. "No book" is one section, oldest first.
     */
    suspend fun page(bookUrl: String?): List<ChapterSection> =
        pageEntries()
            .filter { it.bookUrl == bookUrl }
            .groupBy { it.book?.place?.chapterIndex }
            .toSortedMap(nullsFirst())
            .map { (chapterIndex, entries) ->
                val inOrder = entries.sortedWith(compareBy({ it.book?.place?.position }, { it.at }, { it.id }))
                // The chapter's title as Legado last gave it.
                ChapterSection(chapterIndex, entries.maxBy { it.at }.book?.chapter, inOrder)
            }

    /** The newest [limit] Lookups and Notes across every book, newest first, each on its own. */
    suspend fun recent(limit: Int): List<Entry> {
        val all = lookups.all().map { LookupEntry(it.id, it.value) } + notes.all().map { NoteEntry(it.id, it.value) }
        return all.sortedWith(compareByDescending<Entry> { it.at }.thenByDescending { it.id }).take(limit)
    }

    /** The Lookup [id] with its whole chat and its Notes, or null once it has been deleted. */
    suspend fun lookup(id: Long): LookupEntry? = pageEntries().filterIsInstance<LookupEntry>().find { it.id == id }

    /** Replaces the Note [id]'s text with [text], without the space around it. */
    suspend fun editNote(
        id: Long,
        text: String,
    ) {
        val written = text.trim()
        require(written.isNotEmpty()) { "A Note needs some text" }
        notes.edit(id, written)
    }

    suspend fun deleteNote(id: Long) = notes.delete(id)

    /** Deletes the Lookup [id], its follow-ups and the Notes written on it; the screen asks first. */
    suspend fun deleteLookup(id: Long) = lookups.delete(id)

    /** Each Lookup with the Notes written on it, and each Note written on its own. */
    private suspend fun pageEntries(): List<Entry> {
        val savedLookups = lookups.all()
        val lookupIds = savedLookups.mapTo(HashSet()) { it.id }
        val (onLookups, alone) = notes.all().partition { it.value.lookupId in lookupIds }
        val notesByLookup = onLookups.groupBy({ it.value.lookupId }, { NoteEntry(it.id, it.value) })
        return savedLookups.map { LookupEntry(it.id, it.value, notesByLookup[it.id].orEmpty()) } +
            alone.map { NoteEntry(it.id, it.value) }
    }
}

/** A book on the Books screen: [bookUrl], [book] and [author] are null for "No book". */
data class BookSummary(
    val bookUrl: String?,
    val book: String?,
    val author: String?,
    /** When its newest Lookup or Note was made. */
    val lastAt: Instant,
)

/** One chapter of a Book page; [chapterIndex] and [chapter] are null on the "No book" page. */
data class ChapterSection(
    val chapterIndex: Int?,
    val chapter: String?,
    val entries: List<Entry>,
)

/** A Lookup or a Note as the Book page and Recent list them. */
sealed interface Entry {
    val id: Long

    /** When it was made. */
    val at: Instant

    /** Its book and chapter, or null under "No book". */
    val book: BookLocation?

    val bookUrl: String? get() = book?.place?.bookUrl

    /** When it, or a Note on it, was last made, for ordering the Books screen. */
    val lastAt: Instant get() = at
}

data class LookupEntry(
    override val id: Long,
    val lookup: Lookup,
    /** The Notes written on its card, oldest first; none in Recent, which lists Notes on their own. */
    val notes: List<NoteEntry> = emptyList(),
) : Entry {
    override val at: Instant get() = lookup.madeAt
    override val book: BookLocation? get() = lookup.book
    override val lastAt: Instant get() = (notes.map { it.at } + at).max()
}

data class NoteEntry(
    override val id: Long,
    val note: Note,
) : Entry {
    override val at: Instant get() = note.writtenAt
    override val book: BookLocation? get() = note.book
}
