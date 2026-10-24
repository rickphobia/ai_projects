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
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.core.layout.MAX_PANES
import com.rickphobia.ricknotes.core.layout.MIN_PANE_SHARE
import com.rickphobia.ricknotes.core.layout.makeEqual
import com.rickphobia.ricknotes.core.layout.moveToOtherPane
import com.rickphobia.ricknotes.core.layout.setDivider
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.ink.InkSessions
import com.rickphobia.ricknotes.settings.LayoutSetting
import com.rickphobia.ricknotes.viewer.DocumentNavigation
import com.rickphobia.ricknotes.viewer.DocumentScreen
import com.rickphobia.ricknotes.viewer.DocumentSettings
import com.rickphobia.ricknotes.viewer.DocumentTab
import com.rickphobia.ricknotes.viewer.ReadingPositions
import com.rickphobia.ricknotes.viewer.SharedImage
import java.io.File

// Thin enough not to cover the page, but visible beside the other Pane.
private val FOCUS_MARK_WIDTH = 2.dp
private const val FOCUS_MARK_ALPHA = 0.6f

// A Pane a Tab is dragged over is marked more boldly than the Focused Pane.
private val DROP_MARK_WIDTH = 4.dp

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

/** A shared image, and the path of the Tab it goes onto. */
private class SharedTo(
    val image: SharedImage,
    val path: String?,
)

/**
 * Where each Pane is on screen and which one a dragged Tab is over, so a Tab dropped on the other
 * Pane moves there.
 */
private class TabDragging(
    private val context: PaneContext,
) {
    val paneBounds = mutableStateMapOf<Int, Rect>()
    var over by mutableStateOf<Int?>(null)

    fun dragged(
        from: Int,
        at: Offset,
    ) {
        over = paneAt(at)?.takeIf { it != from }
    }

    fun dropped(
        from: Int,
        tab: Int,
        at: Offset?,
    ) {
        over = null
        if (at != null && paneAt(at).let { it != null && it != from }) move(from, tab)
    }

    private fun paneAt(at: Offset) = paneBounds.entries.firstOrNull { it.value.contains(at) }?.key

    private fun move(
        from: Int,
        tab: Int,
    ) {
        val layout = context.layout.layout
        val moving =
            layout.panes
                .getOrNull(from)
                ?.tabs
                ?.getOrNull(tab) ?: return
        val other = layout.panes.getOrNull((from + 1) % MAX_PANES) ?: return
        // The first Pane's place is kept when it closes, Tabs and all, so its last Tab never reopens.
        val reopens = other.tabs.none { it.path == moving.path } && !(from == 0 && layout.panes[0].tabs.size == 1)
        if (reopens) InkSessions.handOver(File(context.studyFolder, moving.path))
        context.layout.change { moveToOtherPane(from, tab) }
    }
}

/**
 * The Document screen: one or two Panes of Tabs, side by side when the screen is wider than tall
 * and stacked otherwise, so turning the tablet never changes the Layout. The divider between them
 * drags to resize them and a double-tap makes them equal; a Tab long-pressed and dragged onto the
 * other Pane moves there. A [sharedImage] goes onto the Tab selected in the Focused Pane when the
 * screen opened. Closing the last Tab goes home.
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
    val dragging = remember(context) { TabDragging(context) }
    val pane: @Composable (Int, Modifier) -> Unit = { index, modifier ->
        // Keyed by place: when the first Pane closes, the second's Tabs move into the first's place.
        key(index) {
            val shared = sharedImage?.takeIf { sharedTo.first == index }?.let { SharedTo(it, sharedTo.second) }
            OnePane(context, index, shared, dragging, modifier)
        }
    }
    // Follows the finger while the divider is dragged; the Layout is changed (and saved) when it lets go.
    var share by remember(layout.layout.divider) { mutableFloatStateOf(layout.layout.divider) }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val sideBySide = maxWidth > maxHeight
        val length = with(LocalDensity.current) { (if (sideBySide) maxWidth else maxHeight).toPx() }
        val divider =
            DividerActions(
                drag = { share = (share + it / length).coerceIn(MIN_PANE_SHARE, 1 - MIN_PANE_SHARE) },
                dragEnded = { layout.change { setDivider(share) } },
                doubleTap = { layout.change { makeEqual() } },
            )
        val shares = if (paneCount == 1) listOf(1f) else listOf(share, 1 - share)
        if (sideBySide) {
            Row(modifier = Modifier.fillMaxSize()) {
                repeat(paneCount) { index ->
                    if (index > 0) PaneDivider(sideBySide = true, divider)
                    pane(index, Modifier.weight(shares[index]).fillMaxHeight())
                }
            }
        } else {
            Column(modifier = Modifier.fillMaxSize()) {
                repeat(paneCount) { index ->
                    if (index > 0) PaneDivider(sideBySide = false, divider)
                    pane(index, Modifier.weight(shares[index]).fillMaxWidth())
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
    shared: SharedTo?,
    dragging: TabDragging,
    modifier: Modifier,
) {
    val layout = context.layout
    val pane = layout.layout.panes.getOrNull(index) ?: return
    val marked = layout.layout.panes.size > 1 && layout.layout.focused == index
    val selected = pane.selectedTab.path
    // Not Compose state: it only grows while the selected Tab is drawn, so nothing reads it stale.
    val selectedOnce = remember { mutableSetOf<String>() }
    selectedOnce.add(selected)
    DisposableEffect(index) { onDispose { dragging.paneBounds.remove(index) } }
    val navigation =
        DocumentNavigation(
            openPdf = { pdf -> layout.change { open(pdf.treePath, startPosition(context.positions, pdf), index) } },
            onBack = context.navigation.back,
            split = { layout.change { focus(index).split() } },
        )
    val markColour = MaterialTheme.colorScheme.primary
    val mark =
        when {
            dragging.over == index -> Modifier.border(DROP_MARK_WIDTH, markColour)
            marked -> Modifier.border(FOCUS_MARK_WIDTH, markColour.copy(alpha = FOCUS_MARK_ALPHA))
            else -> Modifier
        }

    Column(
        modifier =
            modifier
                .onGloballyPositioned { dragging.paneBounds[index] = it.boundsInRoot() }
                .focusOnTouch { layout.change { focus(index) } }
                .then(mark),
    ) {
        TabBar(
            pane,
            TabActions(
                select = { layout.change { select(index, it) } },
                close = { layout.change { close(index, it) } },
                dragged = { _, at -> dragging.dragged(index, at) },
                dropped = { tab, at -> dragging.dropped(index, tab, at) },
            ),
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
                        shared?.image?.takeIf { tab.path == shared.path },
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
