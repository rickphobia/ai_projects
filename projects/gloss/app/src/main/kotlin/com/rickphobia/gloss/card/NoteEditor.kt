package com.rickphobia.gloss.card

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.rickphobia.gloss.core.Gloss
import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.logging.RollingLog
import com.rickphobia.gloss.storage.NoteDraftStore
import kotlinx.coroutines.CancellationException
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
    /** Save is offered once the Note knows where it goes: its Book context, or its card's Lookup. */
    val canSave: Boolean = false,
    /** The last Save failed; the text is still in the box and the draft. */
    val failed: Boolean = false,
)

/** Where a Note goes: with this Book context, attached to [lookupId] when written on a Lookup's card. */
data class NoteTarget(
    val context: BookContextResult,
    val lookupId: Long? = null,
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
    /** The card's Lookup once it has an answer; null on a Note card and while the AI is answering. */
    private val lookup: () -> NoteTarget?,
) {
    private var current: NoteCardState? by mutableStateOf(null)

    /** Null until the card has a Note: from the Note entry, the Note button or a kept draft. */
    val state: NoteCardState?
        get() = current?.let { it.copy(canSave = !it.saving && it.text.isNotBlank() && target(it) != null) }

    init {
        drafts.read(selection.text)?.let { draft ->
            log.info("note: draft restored")
            current = NoteCardState(text = draft)
        }
    }

    /** A Note card: shows the Book context Legado gives, with no AI call. */
    fun startFromMenu() {
        open()
        scope.launch {
            val context = withContext(Dispatchers.IO) { gloss.noteContext(selection) }
            log.info("note: book context ${if (context is BookContextResult.Found) "found" else "none"}")
            current = current?.copy(context = context)
        }
    }

    /** Opens the Note box on a Define or Explain card. */
    fun open() {
        if (current == null) current = NoteCardState()
    }

    fun edit(text: String) {
        current = current?.copy(text = text, saved = false, failed = false)
        drafts.write(selection.text, text)
    }

    fun discard() {
        drafts.clear()
        current = null
    }

    /**
     * Saves the Note: attached to the card's Lookup when it has an answer, otherwise with the Book
     * context Legado gave, or under "No book".
     */
    fun save() {
        val writing = current?.takeUnless { it.saving || it.saved || it.text.isBlank() } ?: return
        val target = target(writing) ?: return
        current = writing.copy(saving = true, failed = false)
        scope.launch {
            val saved =
                try {
                    withContext(Dispatchers.IO) {
                        gloss.note(selection, writing.text, target.context, target.lookupId)
                    }
                    true
                } catch (e: CancellationException) {
                    throw e
                } catch (
                    @Suppress("TooGenericExceptionCaught") e: Exception,
                ) {
                    // The type only: the message could quote the Note.
                    log.error("note: save failed, ${e.javaClass.name}")
                    false
                }
            if (saved) {
                drafts.clear()
                log.info("note: saved, on_lookup=${target.lookupId != null}")
            }
            current = writing.copy(saving = false, saved = saved, failed = !saved)
        }
    }

    private fun target(note: NoteCardState): NoteTarget? = lookup() ?: note.context?.let(::NoteTarget)
}
