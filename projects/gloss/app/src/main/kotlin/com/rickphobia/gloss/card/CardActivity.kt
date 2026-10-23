package com.rickphobia.gloss.card

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.rickphobia.gloss.core.Selection

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
        val selection = Selection.from(intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT))
        // Never log the Selection itself: it is what the owner is reading.
        if (selection == null) {
            Log.w(LOG_TAG, "Card opened from ${intent.component?.shortClassName} with no text; closing")
            finish()
            return
        }
        Log.i(LOG_TAG, "Card opened from ${intent.component?.shortClassName}")
        setContent {
            GlossTheme {
                SelectionCard(selection = selection, onClose = ::finish)
            }
        }
    }

    private companion object {
        const val LOG_TAG = "Gloss"
    }
}
