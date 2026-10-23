package com.rickphobia.ricknotes.ink

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.core.ink.PagePoint
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.PictureFrame
import com.rickphobia.ricknotes.core.ink.PictureId
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.resizedPicture
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

/** How far from a selected Picture's corner a pen down grabs the corner to resize it, in PDF points. */
internal const val RESIZE_HANDLE_PT = 14f

private val NOT_MOVED = PageOffset(0f, 0f)

/** A loop the Lasso is drawing on [pageId], in page points. */
internal class LassoLoop(
    val pageId: PageId,
) {
    val points = mutableStateListOf<PagePoint>()
}

// A loop narrower or shorter than this, in PDF points, is a slip of the pen, not a selection.
private const val MIN_LOOP_SIZE_PT = 4f

/**
 * What the Lasso selected on [pageId]: the strokes [ids], or the Picture [picture], inside [bounds],
 * dragged [drag] from where they are, and the rectangle round the loop drawn, [loopBounds]. A loop
 * round no strokes still selects its rectangle, so a printed question can be added to a Revision
 * log; [bounds] is then the loop's rectangle. A Picture being resized has its new size in [resized].
 */
internal data class LassoSelection(
    val pageId: PageId,
    val ids: Set<StrokeId>,
    val bounds: PageRect,
    val loopBounds: PageRect,
    val drag: PageOffset = NOT_MOVED,
    val picture: PictureId? = null,
    val resized: PageRect? = null,
) {
    /** Where the selection is shown while the pen has it: dragged or resized, not yet saved. */
    val shown: PageRect get() = (resized ?: bounds).movedBy(drag)

    /** The box shown round the selection, where it is being dragged to; a pen down inside it grabs it. */
    val box: PageRect get() = if (picture != null) shown else shown.grownBy(SELECTION_MARGIN_PT)

    /** The part of the page a Snip of this selection shows: the loop and the strokes, wherever they are now. */
    val snipArea: PageRect get() = loopBounds.union(bounds)

    /** Whether there is anything to move or delete: one of no strokes and no Picture has nothing. */
    val holdsSomething: Boolean get() = ids.isNotEmpty() || picture != null

    /** Whether a pen down at [point] on [onPage] grabs this selection. */
    fun grabbedAt(
        onPage: PageId,
        point: PagePoint,
    ): Boolean = holdsSomething && onPage == pageId && point in box.grownBy(RESIZE_HANDLE_PT / 2)

    /** Whether a pen down at [point] on [onPage] grabs a selected Picture's bottom-right corner. */
    fun cornerAt(
        onPage: PageId,
        point: PagePoint,
    ): Boolean {
        if (picture == null || onPage != pageId) return false
        val corner = PagePoint(box.right, box.bottom)
        return point in PageRect(corner.x, corner.y, corner.x, corner.y).grownBy(RESIZE_HANDLE_PT)
    }
}

private fun PageRect.union(other: PageRect) =
    PageRect(minOf(left, other.left), minOf(top, other.top), maxOf(right, other.right), maxOf(bottom, other.bottom))

private fun Picture.rect() = PageRect(left, top, left + widthPt, top + heightPt)

private fun Picture.selection() = LassoSelection(pageId, emptySet(), rect(), rect(), picture = id)

private fun PictureFrame.rect() = PageRect(left, top, left + widthPt, top + heightPt)

private fun PageRect.frame() = PictureFrame(left, top, right - left, bottom - top)

/** What the pen is doing with the selection it grabbed. */
private enum class Grab { MOVE, RESIZE }

/**
 * The Lasso on one open Document. The pen draws a loop round strokes to select them, or taps a
 * Picture to select it, then drags the selection to move it on its page; a selected Picture's
 * corner resizes it, and [delete] removes the selection. A pen down outside the selection cancels
 * it and starts a new loop. Each move, resize or delete is one undo step in [ink]. Call on the main
 * thread.
 */
internal class LassoTool(
    private val ink: DocumentInk,
) {
    var loop by mutableStateOf<LassoLoop?>(null)
        private set
    var selection by mutableStateOf<LassoSelection?>(null)
        private set

    // Where the pen grabbed the selection and what for, while it is dragging it.
    private var grabbedAt: PagePoint? = null
    private var grab = Grab.MOVE

    /** The pen went down at [point] on [page]. */
    fun down(
        page: PagePlacement,
        point: PagePoint,
    ) {
        val selected = selection
        val how =
            when {
                selected == null -> null
                selected.cornerAt(page.pageId, point) -> Grab.RESIZE
                selected.grabbedAt(page.pageId, point) -> Grab.MOVE
                else -> null
            }
        if (how != null) {
            grabbedAt = point
            grab = how
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
        val selected = selection ?: return
        selection =
            when (grab) {
                Grab.MOVE -> {
                    val wanted = PageOffset(point.x - from.x, point.y - from.y)
                    selected.copy(drag = selected.bounds.keepOnPage(wanted, page.widthPt, page.heightPt))
                }

                Grab.RESIZE -> {
                    selected.copy(
                        resized = resizedPicture(selected.bounds.frame(), point, page.widthPt, page.heightPt).rect(),
                    )
                }
            }
    }

    /** The pen came up: a loop selects what it went round, a tap a Picture, and a drag moves or resizes. */
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
        selection = selection?.copy(drag = NOT_MOVED, resized = null)
    }

    /** Deletes the selected strokes or Picture, as one undo step. */
    fun delete() {
        val selected = selection?.takeIf { it.holdsSomething } ?: return
        selection = null
        val picture = selected.picture
        if (picture != null) {
            ink.deletePicture(picture)
            AppLog.d("Lasso deleted Picture ${picture.value}")
        } else {
            ink.delete(selected.ids)
            AppLog.d("Lasso deleted ${selected.ids.size} strokes")
        }
    }

    /**
     * Lets go of the selection and any loop, for when the strokes change under it or the tool changes.
     * With [selecting], selects that Picture instead, as a tap on it would: a shared image is placed
     * this way, ready to move.
     */
    fun clear(selecting: Picture? = null) {
        loop = null
        grabbedAt = null
        selection = selecting?.selection()
    }

    private fun select(drawn: LassoLoop) {
        val points = drawn.points.toList()
        val loopBounds = boundsOfLoop(points)
        if (!loopBounds.isBigEnough()) {
            // A tap, not a loop: the top Picture under it, if any. A loop never selects Pictures.
            selection =
                ink.picturesOn(drawn.pageId).lastOrNull { points.first() in it.rect() }?.let {
                    AppLog.d("Lasso selected Picture ${it.id.value} on page ${drawn.pageId.value}")
                    it.selection()
                }
            if (selection != null) return
        }
        val inside = strokesInLoop(ink.on(drawn.pageId).map { it.stroke }, drawn.pageId, points)
        val bounds = boundsOf(inside) ?: loopBounds.takeIf { it.isBigEnough() }
        selection = bounds?.let { LassoSelection(drawn.pageId, inside.map { it.id }.toSet(), it, loopBounds) }
        AppLog.d("Lasso selected ${inside.size} strokes on page ${drawn.pageId.value}")
    }

    private fun drop(dragged: LassoSelection) {
        val picture = dragged.picture
        if (picture != null) dropPicture(dragged, picture) else dropStrokes(dragged)
    }

    private fun dropStrokes(dragged: LassoSelection) {
        if (dragged.drag.isZero) return
        if (!ink.move(dragged.ids, dragged.drag)) {
            AppLog.w("Lasso drag dropped but none of its ${dragged.ids.size} strokes are here any more")
            selection = null
            return
        }
        selection = dragged.copy(bounds = dragged.bounds.movedBy(dragged.drag), drag = NOT_MOVED)
        AppLog.d("Lasso moved ${dragged.ids.size} strokes by ${dragged.drag}")
    }

    private fun dropPicture(
        dragged: LassoSelection,
        picture: PictureId,
    ) {
        val now = dragged.shown
        if (now == dragged.bounds) return
        // False only when nothing changed or the Picture is gone; either way the selection follows the session.
        ink.reframe(picture, now.frame())
        val saved = ink.picturesOn(dragged.pageId).firstOrNull { it.id == picture }
        selection =
            saved?.let { dragged.copy(bounds = it.rect(), loopBounds = it.rect(), drag = NOT_MOVED, resized = null) }
        AppLog.d("Lasso moved or resized Picture ${picture.value} to $now")
    }
}

// A loop always has its first point, where the pen went down.
private fun boundsOfLoop(points: List<PagePoint>) =
    PageRect(points.minOf { it.x }, points.minOf { it.y }, points.maxOf { it.x }, points.maxOf { it.y })

private fun PageRect.isBigEnough() = right - left >= MIN_LOOP_SIZE_PT && bottom - top >= MIN_LOOP_SIZE_PT
