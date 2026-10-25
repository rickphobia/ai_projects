package com.rickphobia.gloss.card

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.rickphobia.gloss.core.Gloss
import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.logging.RollingLog
import com.rickphobia.gloss.storage.NoteDraftStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** The Note being written on the card. */
data class NoteCardState(
    val text: String = "",
    /** The Book context shown above a Note from the menu; null while Legado is asked, and on a Lookup's card. */
    val context: BookContextResult? = null,
    val saving: Boolean = false,
    val saved: Boolean = false,
)

/**
 * The Note on one card. Every keystroke is kept as a draft, so a card closed by accident brings it
 * back when opened again on the same Selection. A Note is never sent to the AI.
 */
class NoteEditor(
    private val gloss: Gloss,
    private val selection: Selection,
    private val drafts: NoteDraftStore,
    private val log: RollingLog,
    private val scope: CoroutineScope,
    /** The card's Lookup id and Book context once it has an answer, to attach the Note to. */
    private val lookup: () -> Pair<Long, BookContextResult>?,
) {
    /** Null until the card has a Note: from the Note entry, the Note button or a kept draft. */
    var state: NoteCardState? by mutableStateOf(null)
        private set

    init {
        drafts.read(selection.text)?.let { draft ->
            log.info("note: draft restored")
            state = NoteCardState(text = draft)
        }
    }

    /** A Note card: shows the Book context Legado gives, with no AI call. */
    fun startFromMenu() {
        if (state == null) state = NoteCardState()
        scope.launch {
            val context = withContext(Dispatchers.IO) { gloss.noteContext(selection) }
            log.info("note: book context ${if (context is BookContextResult.Found) "found" else "none"}")
            state = state?.copy(context = context)
        }
    }

    /** Opens the Note box on a Define or Explain card. */
    fun open() {
        if (state == null) state = NoteCardState()
    }

    fun edit(text: String) {
        state = state?.copy(text = text, saved = false)
        drafts.write(selection.text, text)
    }

    fun discard() {
        drafts.clear()
        state = null
    }

    /**
     * Saves the Note: attached to the card's Lookup when it has an answer, otherwise with the Book
     * context Legado gives, or under "No book".
     */
    fun save() {
        val current = state?.takeUnless { it.saving || it.saved || it.text.isBlank() } ?: return
        state = current.copy(saving = true)
        val onLookup = lookup()
        scope.launch {
            withContext(Dispatchers.IO) {
                if (onLookup != null) {
                    gloss.note(selection, current.text, onLookup.second, onLookup.first)
                } else {
                    gloss.note(selection, current.text, current.context ?: gloss.noteContext(selection))
                }
            }
            drafts.clear()
            log.info("note: saved, on_lookup=${onLookup != null}")
            state = current.copy(saving = false, saved = true)
        }
    }
}
