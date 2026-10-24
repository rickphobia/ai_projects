package com.rickphobia.ricknotes.panes

import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.settings.LayoutSetting
import com.rickphobia.ricknotes.viewer.DocumentNavigation
import com.rickphobia.ricknotes.viewer.DocumentScreen
import com.rickphobia.ricknotes.viewer.DocumentSettings
import com.rickphobia.ricknotes.viewer.DocumentTab
import com.rickphobia.ricknotes.viewer.ReadingPositions
import com.rickphobia.ricknotes.viewer.SharedImage

// Thin enough not to cover the page, but visible beside the other Pane.
private val FOCUS_MARK_WIDTH = 2.dp
private const val FOCUS_MARK_ALPHA = 0.6f

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
 * The Document screen: one or two Panes of Tabs, side by side when the screen is wider than tall
 * and stacked otherwise, so turning the tablet never changes the Layout. A [sharedImage] goes onto
 * the Tab selected in the Focused Pane when the screen opened. Closing the last Tab goes home.
 */
@Composable
internal fun PaneScreen(
    context: PaneContext,
    sharedImage: SharedImage?,
) {
    val layout = context.layout
    val paneCount = layout.layout.panes.size
    PaneShortcuts(context)
    if (paneCount == 0) {
        LaunchedEffect(Unit) { context.navigation.home() }
        return
    }
    val sharedTo = remember { layout.layout.focused to layout.layout.selectedTab?.path }
    val pane: @Composable (Int, Modifier) -> Unit = { index, modifier ->
        // Keyed by place: when the first Pane closes, the second's Tabs move into the first's place.
        key(index) {
            OnePane(context, index, sharedImage.takeIf { sharedTo.first == index }, sharedTo.second, modifier)
        }
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        if (maxWidth > maxHeight) {
            Row(modifier = Modifier.fillMaxSize()) {
                repeat(paneCount) { index ->
                    if (index > 0) VerticalDivider()
                    pane(index, Modifier.weight(1f).fillMaxHeight())
                }
            }
        } else {
            Column(modifier = Modifier.fillMaxSize()) {
                repeat(paneCount) { index ->
                    if (index > 0) HorizontalDivider()
                    pane(index, Modifier.weight(1f).fillMaxWidth())
                }
            }
        }
    }
}

/**
 * The Pane at [index]: its tab bar, and the selected Tab showing its Document. A Tab is opened the
 * first time it is selected and stays open, drawing nothing, while another is selected. Touching
 * the Pane anywhere makes it the Focused Pane, which is marked while there are two.
 */
@Composable
private fun OnePane(
    context: PaneContext,
    index: Int,
    sharedImage: SharedImage?,
    sharedPath: String?,
    modifier: Modifier,
) {
    val layout = context.layout
    val pane = layout.layout.panes.getOrNull(index) ?: return
    val marked = layout.layout.panes.size > 1 && layout.layout.focused == index
    val selected = pane.selectedTab.path
    // Not Compose state: it only grows while the selected Tab is drawn, so nothing reads it stale.
    val selectedOnce = remember { mutableSetOf<String>() }
    selectedOnce.add(selected)
    val navigation =
        DocumentNavigation(
            openPdf = { pdf -> layout.change { open(pdf.treePath, startPosition(context.positions, pdf), index) } },
            onBack = context.navigation.back,
            split = { layout.change { focus(index).split() } },
        )
    val markColour = MaterialTheme.colorScheme.primary.copy(alpha = FOCUS_MARK_ALPHA)

    Column(
        modifier =
            modifier
                .focusOnTouch { layout.change { focus(index) } }
                .then(if (marked) Modifier.border(FOCUS_MARK_WIDTH, markColour) else Modifier),
    ) {
        TabBar(
            pane,
            onSelect = { layout.change { select(index, it) } },
            onClose = { layout.change { close(index, it) } },
        )
        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            pane.tabs.filter { it.path in selectedOnce }.forEach { tab ->
                key(tab.path) {
                    val document =
                        remember {
                            val pdf = pdfAt(context.studyFolder, tab.path)
                            DocumentTab(pdf, TabPositions(layout, index, tab.path, context.positions))
                        }
                    DocumentScreen(
                        document,
                        context.settings(document.pdf),
                        sharedImage.takeIf { tab.path == sharedPath },
                        navigation,
                        shown = tab.path == selected,
                    )
                }
            }
        }
    }
}

// Sees every touch before the page, the pen or a button does, and lets it through to them.
private fun Modifier.focusOnTouch(focus: () -> Unit) =
    pointerInput(Unit) {
        awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            focus()
        }
    }

/** Ctrl+W closes the Focused Pane's selected Tab, and Ctrl+\ splits it, while this screen shows. */
@Composable
private fun PaneShortcuts(context: PaneContext) {
    DisposableEffect(context.shortcuts) {
        val layout = context.layout
        context.shortcuts.closeTab = {
            layout.change { panes.getOrNull(focused)?.let { close(focused, it.selected) } ?: this }
        }
        context.shortcuts.split = { layout.change { split() } }
        onDispose {
            context.shortcuts.closeTab = null
            context.shortcuts.split = null
        }
    }
}
