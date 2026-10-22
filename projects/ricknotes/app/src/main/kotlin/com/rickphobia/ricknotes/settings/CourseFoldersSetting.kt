package com.rickphobia.ricknotes.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.rickphobia.ricknotes.core.settings.CourseFoldersLoader
import com.rickphobia.ricknotes.core.settings.InvalidSettingException
import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore
import com.rickphobia.ricknotes.core.studyfolder.CourseFolders
import com.rickphobia.ricknotes.home.CourseFolderActions
import com.rickphobia.ricknotes.logging.AppLog

/** The Course folder marks as the screens see them: loaded once, saved on every change. */
class CourseFoldersSetting<S>(
    private val settings: S,
) : CourseFolderActions where S : SettingsSource, S : SettingsStore {
    override var folders by mutableStateOf(load())
        private set

    override fun mark(folder: String) = change(folders.mark(folder), "marked")

    override fun unmark(folder: String) = change(folders.unmark(folder), "unmarked")

    private fun change(
        folders: CourseFolders,
        what: String,
    ) {
        CourseFoldersLoader.save(settings, folders)
        AppLog.i("Course folder $what (${folders.marked.size} marked, ${folders.unmarked.size} unmarked)")
        this.folders = folders
    }

    // Broken lists mustn't hide the tree: the default depth still works, and the next mark rewrites them.
    private fun load(): CourseFolders =
        try {
            CourseFoldersLoader.load(settings)
        } catch (e: InvalidSettingException) {
            AppLog.w("stored Course folder marks unusable, using the default: ${e.message}")
            CourseFolders()
        }
}
