package com.rickphobia.ricknotes.core.layout

import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/** Saves the Layout as JSON in the app settings, and restores it on start. */
object LayoutLoader {
    const val LAYOUT_KEY = "layout"

    private val json =
        Json {
            // A newer app may add fields (the divider, the Focused Pane); this one still reads its Tabs.
            ignoreUnknownKeys = true
        }

    fun save(
        store: SettingsStore,
        layout: Layout,
    ) {
        store.write(LAYOUT_KEY, json.encodeToString(LayoutJson.serializer(), layout.toJson()))
    }

    /**
     * The saved Layout, or an empty one when none is saved. A damaged one also starts empty, after
     * [warn] is told why: losing the Tabs only costs reopening them. The warning leaves the stored
     * paths out, since they name the owner's files.
     */
    fun restore(
        source: SettingsSource,
        warn: (String) -> Unit,
    ): Layout {
        val stored = source.read(LAYOUT_KEY) ?: return Layout()
        return try {
            json.decodeFromString(LayoutJson.serializer(), stored).toLayout()
        } catch (e: SerializationException) {
            warn("Setting '$LAYOUT_KEY' is not valid Layout JSON (${e::class.simpleName}); starting with no Tabs")
            Layout()
        } catch (e: IllegalArgumentException) {
            warn("Setting '$LAYOUT_KEY' can't be used: ${e.message}; starting with no Tabs")
            Layout()
        }
    }

    private fun Layout.toJson() =
        LayoutJson(
            panes.map { pane ->
                PaneJson(pane.tabs.map { TabJson(it.path, it.position.pageIndex, it.position.zoom) }, pane.selected)
            },
        )

    private fun LayoutJson.toLayout() =
        Layout(
            panes.map { pane ->
                Pane(
                    pane.tabs.map { tab ->
                        require(tab.path.isNotBlank()) { "a Tab has no path" }
                        require(tab.page >= 0) { "a Tab is at page ${tab.page}" }
                        Tab(tab.path, TabPosition(tab.page, tab.zoom))
                    },
                    pane.selected,
                )
            },
        )
}

@Serializable
private class LayoutJson(
    val panes: List<PaneJson>,
)

@Serializable
private class PaneJson(
    val tabs: List<TabJson>,
    val selected: Int,
)

@Serializable
private class TabJson(
    val path: String,
    val page: Int,
    val zoom: Float,
)
