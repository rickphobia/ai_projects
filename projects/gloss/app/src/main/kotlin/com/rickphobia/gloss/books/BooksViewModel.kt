package com.rickphobia.gloss.books

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rickphobia.gloss.core.bookpage.BookPages
import com.rickphobia.gloss.core.bookpage.BookSummary
import com.rickphobia.gloss.core.bookpage.ChapterSection
import com.rickphobia.gloss.core.bookpage.Entry
import com.rickphobia.gloss.core.bookpage.LookupEntry
import com.rickphobia.gloss.logging.RollingLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Where the owner is in Gloss's own screens. */
sealed interface BooksPlace {
    /** The Books screen, with its Books and Recent tabs. */
    data object Shelf : BooksPlace

    data class Book(
        val summary: BookSummary,
    ) : BooksPlace

    data class Lookup(
        val id: Long,
    ) : BooksPlace
}

/**
 * The Books screen, Book pages and past Lookups: what is open, what it shows, and the edits and
 * deletes. Each change reloads what is on screen from the database, so the lists never disagree
 * with it.
 */
class BooksViewModel(
    private val pages: BookPages,
    private val recentSize: Int,
    private val log: RollingLog,
) : ViewModel() {
    /** The places opened so far; the last is on screen, and back closes it. */
    var stack: List<BooksPlace> by mutableStateOf(listOf(BooksPlace.Shelf))
        private set

    var books: List<BookSummary> by mutableStateOf(emptyList())
        private set
    var recent: List<Entry> by mutableStateOf(emptyList())
        private set

    /** The open Book page's chapters, or null while it loads. */
    var page: List<ChapterSection>? by mutableStateOf(null)
        private set

    /** The open Lookup, or null while it loads or once it has been deleted. */
    var lookup: LookupEntry? by mutableStateOf(null)
        private set

    val current: BooksPlace get() = stack.last()

    fun open(place: BooksPlace) {
        // Not the last page or Lookup opened while this one loads.
        when (place) {
            is BooksPlace.Book -> page = null
            is BooksPlace.Lookup -> lookup = null
            BooksPlace.Shelf -> Unit
        }
        stack = stack + place
        reload()
    }

    /** Closes what is on screen; the Books screen itself is left by Android's own back. */
    fun back() {
        if (stack.size == 1) return
        stack = stack.dropLast(1)
        reload()
    }

    fun editNote(
        id: Long,
        text: String,
    ) = change("note edited id=$id") { pages.editNote(id, text) }

    fun deleteNote(id: Long) = change("note deleted id=$id") { pages.deleteNote(id) }

    fun deleteLookup(id: Long) {
        // An open Lookup that is deleted closes, back to where it was opened from.
        if (current == BooksPlace.Lookup(id)) stack = stack.dropLast(1)
        change("lookup deleted id=$id") { pages.deleteLookup(id) }
    }

    /**
     * Loads what is on screen again, such as when the owner comes back from the card. A load that
     * finishes after the owner has moved on is dropped, so it can't show on another page. A Lookup
     * that is gone, or a Book page left empty by a delete, closes.
     */
    fun reload() {
        val place = current
        viewModelScope.launch {
            when (place) {
                BooksPlace.Shelf -> {
                    val (shelf, latest) = io { pages.books() to pages.recent(recentSize) }
                    if (current != place) return@launch
                    books = shelf
                    recent = latest
                }

                is BooksPlace.Book -> {
                    val loaded = io { pages.page(place.summary.bookUrl) }
                    if (current != place) return@launch
                    if (loaded.isEmpty()) back() else page = loaded
                }

                is BooksPlace.Lookup -> {
                    val loaded = io { pages.lookup(place.id) }
                    if (current != place) return@launch
                    if (loaded == null) back() else lookup = loaded
                }
            }
        }
    }

    private fun change(
        what: String,
        action: suspend () -> Unit,
    ) {
        viewModelScope.launch {
            io { action() }
            log.info(what)
            reload()
        }
    }

    private suspend fun <T> io(block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
