package com.rickphobia.ricknotes.ink

import androidx.compose.runtime.mutableStateMapOf
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePoint
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.session.strokesTouched
import com.rickphobia.ricknotes.logging.AppLog

/**
 * The stroke eraser on one open Document: the strokes it touches in a gesture are hidden at once,
 * and erased from [ink], as one undo step, when the pen comes up. Call on the main thread.
 */
internal class EraserTool(
    private val ink: DocumentInk,
) {
    // Strokes the eraser has touched in the gesture still going on: hidden, but not yet erased.
    private val erasing = mutableStateMapOf<StrokeId, Unit>()

    fun hides(id: StrokeId): Boolean = id in erasing

    /** Hides the strokes on [pageId] the eraser touches moving from [from] to [to]; [finish] erases them. */
    fun along(
        pageId: PageId,
        from: PagePoint,
        to: PagePoint,
    ) {
        strokesTouched(ink.on(pageId).map { it.stroke }, pageId, from, to).forEach { erasing[it.id] = Unit }
    }

    /** Erases what the eraser touched in this gesture, as one undo step. */
    fun finish() {
        if (erasing.isEmpty()) return
        val ids = erasing.keys.toSet()
        ink.delete(ids)
        erasing.clear()
        AppLog.d("erased ${ids.size} strokes")
    }

    /** Shows again what a cancelled gesture touched. */
    fun cancel() = erasing.clear()
}
