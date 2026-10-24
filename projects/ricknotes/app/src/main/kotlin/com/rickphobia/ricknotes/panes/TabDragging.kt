package com.rickphobia.ricknotes.panes

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import com.rickphobia.ricknotes.core.layout.MAX_PANES
import com.rickphobia.ricknotes.core.layout.moveToOtherPane
import com.rickphobia.ricknotes.core.studyfolder.TreeNode
import com.rickphobia.ricknotes.ink.InkSessions
import java.io.File

/**
 * Where each Pane and the tree drawer are on screen and which Pane a dragged Tab or Document is
 * over, so a Tab dropped on the other Pane moves there and a Document dropped on a Pane opens there.
 */
internal class TabDragging(
    private val context: PaneContext,
) {
    val paneBounds = mutableStateMapOf<Int, Rect>()
    var drawerBounds by mutableStateOf<Rect?>(null)
    var over by mutableStateOf<Int?>(null)

    fun dragged(
        from: Int,
        at: Offset,
    ) {
        over = paneAt(paneBounds, at, from)
    }

    fun dropped(
        from: Int,
        tab: Int,
        at: Offset?,
    ) {
        over = null
        if (at != null && paneAt(paneBounds, at, from) != null) move(from, tab)
    }

    fun documentDragged(at: Offset) {
        over = paneAt(paneBounds, at, covered = drawerBounds)
    }

    /** Opens [document] in the Pane it was let go on and focuses it; false if it landed on none. */
    fun documentDropped(
        document: TreeNode.Document,
        at: Offset?,
    ): Boolean {
        over = null
        val pane = at?.let { paneAt(paneBounds, it, covered = drawerBounds) } ?: return false
        val pdf = pdfAt(context.studyFolder, document.path)
        context.layout.change { open(document.path, startPosition(context.positions, pdf), pane).focus(pane) }
        return true
    }

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
