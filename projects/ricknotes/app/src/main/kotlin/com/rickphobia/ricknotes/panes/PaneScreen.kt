package com.rickphobia.ricknotes.panes

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.rickphobia.ricknotes.core.layout.Layout
import com.rickphobia.ricknotes.core.layout.TabPosition
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.settings.LayoutSetting
import com.rickphobia.ricknotes.viewer.DocumentNavigation
import com.rickphobia.ricknotes.viewer.DocumentScreen
import com.rickphobia.ricknotes.viewer.DocumentSettings
import com.rickphobia.ricknotes.viewer.DocumentTab
import com.rickphobia.ricknotes.viewer.ReadingPosition
import com.rickphobia.ricknotes.viewer.ReadingPositions
import com.rickphobia.ricknotes.viewer.SharedImage
import com.rickphobia.ricknotes.viewer.ZoomLimits
import java.io.File

// Until a second Pane can be opened, every Tab is in the first.
private const val PANE = 0

/** Where the Pane screen leads: Back goes [back]; closing the last Tab goes [home]. */
internal class PaneNavigation(
    val back: () -> Unit,
    val home: () -> Unit,
)

/** What the Pane screen needs from the app: where things are kept, and where it leads. */
internal class PaneContext(
    val studyFolder: String,
    val layout: LayoutSetting<*>,
    val positions: ReadingPositions,
    val shortcuts: KeyShortcuts,
    val settings: (PdfEntry) -> DocumentSettings,
    val navigation: PaneNavigation,
)

/**
 * The Document screen: one Pane of Tabs, the selected one showing its Document. A Tab is opened
 * the first time it is selected and stays open, drawing nothing, while another is selected. A
 * [sharedImage] goes onto the Tab selected when the screen opened. Closing the last Tab goes home.
 */
@Composable
internal fun PaneScreen(
    context: PaneContext,
    sharedImage: SharedImage?,
) {
    val layout = context.layout
    val pane = layout.layout.panes.getOrNull(PANE)
    CloseTabShortcut(context)
    if (pane == null) {
        LaunchedEffect(Unit) { context.navigation.home() }
        return
    }
    val selected = pane.selectedTab.path
    val sharedTo = remember { selected }
    // Not Compose state: it only grows while the selected Tab is drawn, so nothing reads it stale.
    val selectedOnce = remember { mutableSetOf<String>() }
    selectedOnce.add(selected)
    val navigation =
        DocumentNavigation(
            openPdf = { pdf -> layout.change { open(pdf.treePath, startPosition(context.positions, pdf)) } },
            onBack = context.navigation.back,
        )

    Column(modifier = Modifier.fillMaxSize()) {
        TabBar(pane, onSelect = { layout.change { select(PANE, it) } }, onClose = { layout.change { close(PANE, it) } })
        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            pane.tabs.filter { it.path in selectedOnce }.forEach { tab ->
                key(tab.path) {
                    val document =
                        remember {
                            val pdf = pdfAt(context.studyFolder, tab.path)
                            DocumentTab(pdf, TabPositions(layout, tab.path, context.positions))
                        }
                    DocumentScreen(
                        document,
                        context.settings(document.pdf),
                        sharedImage.takeIf { tab.path == sharedTo },
                        navigation,
                        shown = tab.path == selected,
                    )
                }
            }
        }
    }
}

/** Ctrl+W closes the selected Tab while this screen shows. */
@Composable
private fun CloseTabShortcut(context: PaneContext) {
    DisposableEffect(context.shortcuts) {
        context.shortcuts.closeTab = {
            context.layout.change { panes.getOrNull(PANE)?.let { close(PANE, it.selected) } ?: this }
        }
        onDispose { context.shortcuts.closeTab = null }
    }
}

/**
 * Where a Document not yet in a Tab opens: where it was last left, from [positions], or the top.
 */
internal fun startPosition(
    positions: ReadingPositions,
    pdf: PdfEntry,
): TabPosition {
    val position = positions.load(pdf.path) ?: ReadingPosition(0, ZoomLimits.MIN)
    return TabPosition(position.pageIndex, position.zoom)
}

/** The PDF at tree [path] in [studyFolder]. */
internal fun pdfAt(
    studyFolder: String,
    path: String,
) = PdfEntry(
    File(studyFolder, path).path,
    path.substringBeforeLast('/', missingDelimiterValue = ""),
    path.substringAfterLast('/'),
)

/**
 * One Tab's reading position: kept in the Layout, so the Tab comes back where it was, and in the
 * Document's own [ReadingPositions], so it reopens there after its Tab is closed.
 */
private class TabPositions(
    private val layout: LayoutSetting<*>,
    private val path: String,
    private val documents: ReadingPositions,
) : ReadingPositions {
    override fun load(documentPath: String): ReadingPosition? =
        tabIndex(layout.layout)?.let { index ->
            layout.layout.panes[PANE]
                .tabs[index]
                .position
                .let { ReadingPosition(it.pageIndex, it.zoom) }
        }

    override fun save(
        documentPath: String,
        position: ReadingPosition,
    ) {
        documents.save(documentPath, position)
        // A closed Tab saves its position as it goes: then only the Document keeps it.
        layout.change {
            tabIndex(
                this,
            )?.let { moved(PANE, it, TabPosition(position.pageIndex, position.zoom)) } ?: this
        }
    }

    private fun tabIndex(layout: Layout): Int? =
        layout.panes
            .getOrNull(PANE)
            ?.tabs
            ?.indexOfFirst { it.path == path }
            ?.takeIf { it >= 0 }
}
