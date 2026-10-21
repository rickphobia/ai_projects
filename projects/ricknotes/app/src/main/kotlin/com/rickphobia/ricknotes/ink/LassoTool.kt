package com.rickphobia.ricknotes.ink

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.core.ink.PagePoint
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.session.PageOffset
import com.rickphobia.ricknotes.core.session.PageRect
import com.rickphobia.ricknotes.core.session.boundsOf
import com.rickphobia.ricknotes.core.session.strokesInLoop
import com.rickphobia.ricknotes.logging.AppLog

/**
 * How far round its strokes a selection's box reaches, in PDF points: about 2 mm, so a selection of
 * one thin stroke is still easy to grab with the pen.
 */
internal const val SELECTION_MARGIN_PT = 6f

private val NOT_MOVED = PageOffset(0f, 0f)

/** A loop the Lasso is drawing on [pageId], in page points. */
internal class LassoLoop(
    val pageId: PageId,
) {
    val points = mutableStateListOf<PagePoint>()
}

/** The strokes the Lasso selected on [pageId], inside [bounds], dragged [drag] from where they are. */
internal data class LassoSelection(
    val pageId: PageId,
    val ids: Set<StrokeId>,
    val bounds: PageRect,
    val drag: PageOffset = NOT_MOVED,
) {
    /** The box shown round the selection, where it is being dragged to; a pen down inside it grabs it. */
    val box: PageRect get() = bounds.movedBy(drag).grownBy(SELECTION_MARGIN_PT)
}

/**
 * The Lasso on one open Document. The pen draws a loop round strokes to select them, then drags the
 * selection to move it on its page; [delete] removes it. A pen down outside the selection cancels
 * it and starts a new loop. Each move or delete is one undo step in [ink]. Call on the main thread.
 */
internal class LassoTool(
    private val ink: DocumentInk,
) {
    var loop by mutableStateOf<LassoLoop?>(null)
        private set
    var selection by mutableStateOf<LassoSelection?>(null)
        private set

    // Where the pen grabbed the selection, while it is dragging it.
    private var grabbedAt: PagePoint? = null

    /** The pen went down at [point] on [page]. */
    fun down(
        page: PagePlacement,
        point: PagePoint,
    ) {
        val selected = selection
        if (selected != null && selected.pageId == page.pageId && point in selected.box) {
            grabbedAt = point
            return
        }
        selection = null
        loop = LassoLoop(page.pageId).apply { points.add(point) }
    }

    /** The pen moved to [point] on [page], the page it went down on. */
    fun moveTo(
        page: PagePlacement,
        point: PagePoint,
    ) {
        loop?.points?.add(point)
        val from = grabbedAt ?: return
        selection =
            selection?.let {
                val wanted = PageOffset(point.x - from.x, point.y - from.y)
                it.copy(drag = it.bounds.keepOnPage(wanted, page.widthPt, page.heightPt))
            }
    }

    /** The pen came up: a loop selects what it went round, and a drag moves the selection there. */
    fun up() {
        loop?.let(::select)
        loop = null
        if (grabbedAt != null) {
            grabbedAt = null
            selection?.let(::drop)
        }
    }

    /** The gesture was cancelled: no new selection, and a dragged one goes back where it was. */
    fun cancel() {
        loop = null
        grabbedAt = null
        selection = selection?.copy(drag = NOT_MOVED)
    }

    /** Deletes the selected strokes, as one undo step. */
    fun delete() {
        val selected = selection ?: return
        ink.delete(selected.ids)
        selection = null
        AppLog.d("Lasso deleted ${selected.ids.size} strokes")
    }

    /** Lets go of the selection and any loop, for when the strokes change under it or the tool changes. */
    fun clear() {
        loop = null
        grabbedAt = null
        selection = null
    }

    private fun select(drawn: LassoLoop) {
        val inside = strokesInLoop(ink.on(drawn.pageId).map { it.stroke }, drawn.pageId, drawn.points.toList())
        selection = boundsOf(inside)?.let { LassoSelection(drawn.pageId, inside.map { it.id }.toSet(), it) }
        AppLog.d("Lasso selected ${inside.size} strokes on page ${drawn.pageId.value}")
    }

    private fun drop(dragged: LassoSelection) {
        if (dragged.drag.isZero) return
        if (!ink.move(dragged.ids, dragged.drag)) {
            AppLog.w("Lasso drag dropped but none of its ${dragged.ids.size} strokes are here any more")
            selection = null
            return
        }
        selection = dragged.copy(bounds = dragged.bounds.movedBy(dragged.drag), drag = NOT_MOVED)
        AppLog.d("Lasso moved ${dragged.ids.size} strokes by ${dragged.drag}")
    }
}
