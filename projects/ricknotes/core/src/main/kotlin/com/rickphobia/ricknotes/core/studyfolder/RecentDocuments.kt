package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore

/**
 * The last [LIMIT] Documents opened, newest first, kept in the app settings as tree paths
 * (relative to the Study folder) one per line. Paths are relative so a renamed Study folder
 * doesn't leave them pointing at the old place.
 */
class RecentDocuments(
    private val source: SettingsSource,
    private val store: SettingsStore,
) {
    /** The stored paths. A missing or messy stored list is read leniently: it only costs the Recent row. */
    fun paths(): List<String> =
        source
            .read(KEY)
            .orEmpty()
            .lines()
            .filter { it.isNotBlank() }
            .distinct()
            .take(LIMIT)

    /** Records that the Document at tree [path] was opened and returns the new list. */
    fun opened(path: String): List<String> {
        val updated = (listOf(path) + paths().filter { it != path }).take(LIMIT)
        store.write(KEY, updated.joinToString("\n"))
        return updated
    }

    companion object {
        const val KEY = "recent_documents"
        const val LIMIT = 8
    }
}
