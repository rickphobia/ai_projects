package com.rickphobia.gloss.card

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
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
        val factory = viewModelFactory { initializer { CardViewModel(app.gloss, selection) } }
        val card: CardViewModel by viewModels { factory }
        setContent {
            GlossTheme {
                SelectionCard(
                    selection = card.selection,
                    result = card.result,
                    onRetry = card::retry,
                    onOpenKeySettings = ::openKeySettings,
                    onClose = ::finish,
                )
            }
        }
    }

    /** Opens Gloss's own screen in its own task, over the reader; Retry works once the owner is back. */
    private fun openKeySettings() {
        startActivity(SettingsActivity.changeKeyIntent(this).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
