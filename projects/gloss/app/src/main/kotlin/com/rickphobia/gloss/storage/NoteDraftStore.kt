package com.rickphobia.gloss.storage

import android.content.Context
import androidx.core.content.edit

/**
 * The Note being written, kept on every keystroke so a card closed by accident loses nothing. There
 * is one draft, for one Selection: opening a card on that Selection again brings it back, until it
 * is saved or discarded. Private storage, excluded from backup like the database.
 */
class NoteDraftStore(
    context: Context,
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** The unsaved Note text for [selection], or null when there is none. */
    fun read(selection: String): String? =
        prefs.getString(TEXT, null)?.takeIf { prefs.getString(SELECTION, null) == selection }

    fun write(
        selection: String,
        text: String,
    ) {
        prefs.edit {
            putString(SELECTION, selection)
            putString(TEXT, text)
        }
    }

    fun clear() {
        prefs.edit { clear() }
    }

    private companion object {
        const val PREFS_NAME = "note_draft"
        const val SELECTION = "selection"
        const val TEXT = "text"
    }
}
