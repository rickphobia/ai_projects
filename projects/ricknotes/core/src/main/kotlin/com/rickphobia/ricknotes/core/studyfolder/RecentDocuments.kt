package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore

/**
 * The last [LIMIT] Documents opened, newest first, kept in the app settings as tree paths
 * (relative to the Study folder) one per line. Paths are relative so a renamed Study folder
 * doesn't leave them pointing at the old place.
 */
class RecentDocuments<S>(
    private val settings: S,
) where S : SettingsSource, S : SettingsStore {
    /** The stored paths. A missing or messy stored list is read leniently: it only costs the Recent row. */
    fun paths(): List<String> =
        settings
            .read(KEY)
            .orEmpty()
            .lines()
            .filter { it.isNotBlank() }
            .distinct()
            .take(LIMIT)

    /** Records that the Document at tree [path] was opened. */
    fun opened(path: String) {
        val updated = (listOf(path) + paths().filter { it != path }).take(LIMIT)
        settings.write(KEY, updated.joinToString("\n"))
    }

    companion object {
        const val KEY = "recent_documents"
        const val LIMIT = 8
    }
}
