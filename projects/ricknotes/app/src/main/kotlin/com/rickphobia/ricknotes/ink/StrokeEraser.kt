package com.rickphobia.ricknotes.ink

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.core.ink.PagePoint
import com.rickphobia.ricknotes.core.ink.ScreenPoint

/**
 * Erases whole strokes along the path of each erasing pointer: the pen in eraser mode, or a finger
 * with Finger erase on. Each pointer erases only on the page it touched down on, and what one
 * gesture touches is erased as one undo step when it ends, or left as it was if it is cancelled.
 */
internal class StrokeEraser(
    private val ink: DocumentInk,
    private val placements: () -> List<PagePlacement>,
) {
    // Where each erasing pointer was last.
    private val erasers = mutableMapOf<Int, EraserAt>()

    private data class EraserAt(
        val pageId: PageId,
        val point: PagePoint,
    )

    fun start(
        pointerId: Int,
        page: PagePlacement,
        at: ScreenPoint,
    ) {
        val point = page.toPage(at)
        erasers[pointerId] = EraserAt(page.pageId, point)
        ink.eraseAlong(page.pageId, point, point)
    }

    /** Does nothing for a pointer that isn't erasing. */
    fun extend(
        pointerId: Int,
        at: ScreenPoint,
    ) {
        val last = erasers[pointerId] ?: return
        val page = placements().firstOrNull { it.pageId == last.pageId } ?: return
        val point = page.toPage(at)
        ink.eraseAlong(last.pageId, last.point, point)
        erasers[pointerId] = last.copy(point = point)
    }

    fun end(pointerId: Int) {
        if (erasers.remove(pointerId) != null) ink.finishErase()
    }

    fun cancel(pointerId: Int) {
        if (erasers.remove(pointerId) != null) ink.cancelErase()
    }

    /**
     * Calls off every erase still going. [DocumentInk] keeps one erase at a time, so the pen
     * starting calls off a finger's first; otherwise the finger's cancel would undo the pen's too.
     */
    fun cancelAll() {
        if (erasers.isEmpty()) return
        erasers.clear()
        ink.cancelErase()
    }
}
