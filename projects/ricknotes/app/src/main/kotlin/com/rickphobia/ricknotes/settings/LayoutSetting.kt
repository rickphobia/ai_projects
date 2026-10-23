package com.rickphobia.ricknotes.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.rickphobia.ricknotes.core.layout.Layout
import com.rickphobia.ricknotes.core.layout.LayoutLoader
import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore
import com.rickphobia.ricknotes.logging.AppLog

/** The Layout as the screens see it: restored once on start, saved on every change. */
class LayoutSetting<S>(
    private val settings: S,
) where S : SettingsSource, S : SettingsStore {
    var layout by mutableStateOf(restore())
        private set

    fun change(change: Layout.() -> Layout) {
        val changed = layout.change()
        if (changed == layout) return
        LayoutLoader.save(settings, changed)
        if (changed.shape != layout.shape) AppLog.i("layout: ${changed.shape}")
        layout = changed
    }

    private fun restore(): Layout =
        LayoutLoader.restore(settings, AppLog::w).also {
            AppLog.i("layout restored: ${it.shape}")
        }

    // Counts only: the paths name the owner's files.
    private val Layout.shape: String
        get() = "${panes.size} Panes, ${panes.sumOf { it.tabs.size }} Tabs"
}
