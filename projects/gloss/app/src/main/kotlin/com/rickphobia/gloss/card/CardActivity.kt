package com.rickphobia.gloss.card

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.rickphobia.gloss.GlossApplication
import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.settings.SettingsActivity

/**
 * Opened from the text-selection menu (the manifest's aliases, such as Define) with the
 * highlighted text, and shows the card over the reader.
 *
 * It never sets a result: a PROCESS_TEXT activity that returns text replaces the reader's
 * Selection with it, and Gloss only reads.
 */
class CardActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as GlossApplication
        val selection = Selection.from(intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT))
        // Never log the Selection itself: it is what the owner is reading.
        if (selection == null) {
            app.log.warning("Card opened from ${intent.component?.shortClassName} with no text; closing")
            finish()
            return
        }
        app.log.info("Card opened from ${intent.component?.shortClassName}")
        val entry = intent.component?.className.orEmpty()
        val kind =
            when {
                entry.endsWith(EXPLAIN_ALIAS) -> CardKind.Explain
                entry.endsWith(NOTE_ALIAS) -> CardKind.Note
                else -> CardKind.Define
            }
        val factory =
            viewModelFactory { initializer { CardViewModel(app.gloss, selection, kind, app.log, app.noteDrafts) } }
        val card: CardViewModel by viewModels { factory }
        setContent {
            // A Note card has done its job once the Note is saved: back to the page.
            val noteSaved = card.note.state?.saved == true
            LaunchedEffect(noteSaved) { if (noteSaved && kind == CardKind.Note) finish() }
            GlossTheme {
                SelectionCard(
                    selection = card.selection,
                    kind = kind,
                    define = card.define,
                    explain = card.explain,
                    note = card.note.state,
                    question = card.question,
                    onQuestionChange = card::editQuestion,
                    onAsk = card::ask,
                    onExplainMore = card::explainMore,
                    onRetry = card::retry,
                    onOpenKeySettings = ::openKeySettings,
                    onOpenNote = card.note::open,
                    onNoteChange = card.note::edit,
                    onSaveNote = card.note::save,
                    onDiscardNote = {
                        card.note.discard()
                        if (kind == CardKind.Note) finish()
                    },
                    onClose = ::finish,
                )
            }
        }
    }

    private companion object {
        /** The manifest's Explain and Note entries; every other entry opens a Define. */
        const val EXPLAIN_ALIAS = ".card.Explain"
        const val NOTE_ALIAS = ".card.Note"
    }

    /**
     * Opens the key box over the card, in the reader's task, so saving the key or pressing back
     * returns to the card, where Retry waits.
     */
    private fun openKeySettings() {
        startActivity(SettingsActivity.changeKeyIntent(this))
    }
}
