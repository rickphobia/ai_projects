package com.rickphobia.ricknotes.core.redink

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.Tool
import com.rickphobia.ricknotes.core.session.PageRect
import com.rickphobia.ricknotes.core.session.boundsOf
import kotlin.math.hypot
import kotlin.math.max

/** A page of the Document as it shows, with its size in PDF points: what Red marks are found on. */
data class MarkedPage(
    val id: PageId,
    val widthPt: Float,
    val heightPt: Float,
)

/**
 * One group of red strokes written for one mistake: [strokeIds] on [pageId] in drawing order, and
 * the [box] holding them all, in page points.
 */
data class RedMark(
    val pageId: PageId,
    val strokeIds: List<StrokeId>,
    val box: PageRect,
)

/** Finds a Document's Red marks among its strokes (spec, Red marks). Pure, so any thread may call it. */
object RedMarks {
    /** A red stroke drawn at most this long after its group's last one ended joins the group. */
    const val TIME_LIMIT_MS = 60_000L

    /**
     * A red stroke whose box is at most this share of its page's shorter side from its group's box
     * joins the group: about the gap between two tutorial questions. A first guess, to be tuned on
     * real pages.
     */
    const val DISTANCE_LIMIT_SHARE = 0.2f

    /** A group is offered only once its last stroke ended more than this long ago: it may still be written. */
    const val SETTLE_MS = 60_000L

    /**
     * The Red marks among [strokes] at [nowMs], in the order of [pages] and then by when they were
     * started. Strokes in [leftOut] (logged or hidden already) are skipped before grouping, so ink
     * added beside them later makes a new Red mark. Strokes on a page not in [pages] are skipped.
     */
    fun find(
        strokes: List<Stroke>,
        pages: List<MarkedPage>,
        nowMs: Long,
        leftOut: Set<StrokeId>,
    ): List<RedMark> {
        val red = strokes.filter { it.isRedInk() && it.id !in leftOut }.groupBy { it.pageId }
        return pages.flatMap { page ->
            groups(red[page.id].orEmpty().sortedBy { it.drawnAtMs }, page)
                .filter { nowMs - it.endedAtMs > SETTLE_MS }
                .map { RedMark(page.id, it.strokes.map(Stroke::id), it.box) }
        }
    }

    private fun Stroke.isRedInk(): Boolean = tool == Tool.PEN && colourArgb == PenColour.RED.argb

    // Each stroke joins the group before it when close enough in time and on the page, else starts a new one.
    private fun groups(
        strokes: List<Stroke>,
        page: MarkedPage,
    ): List<Group> {
        val distanceLimit = minOf(page.widthPt, page.heightPt) * DISTANCE_LIMIT_SHARE
        val groups = mutableListOf<Group>()
        for (stroke in strokes) {
            val box = checkNotNull(boundsOf(listOf(stroke)))
            val current = groups.lastOrNull()
            if (current != null &&
                stroke.drawnAtMs - current.endedAtMs <= TIME_LIMIT_MS &&
                distance(current.box, box) <= distanceLimit
            ) {
                groups[groups.lastIndex] = current.with(stroke, box)
            } else {
                groups += Group(listOf(stroke), box, stroke.endedAtMs())
            }
        }
        return groups
    }

    private class Group(
        val strokes: List<Stroke>,
        val box: PageRect,
        val endedAtMs: Long,
    ) {
        fun with(
            stroke: Stroke,
            strokeBox: PageRect,
        ) = Group(
            strokes + stroke,
            PageRect(
                minOf(box.left, strokeBox.left),
                minOf(box.top, strokeBox.top),
                maxOf(box.right, strokeBox.right),
                maxOf(box.bottom, strokeBox.bottom),
            ),
            max(endedAtMs, stroke.endedAtMs()),
        )
    }

    private fun Stroke.endedAtMs(): Long = drawnAtMs + points.last().elapsedMs

    // The shortest gap between two rectangles; 0 when they touch or overlap.
    private fun distance(
        a: PageRect,
        b: PageRect,
    ): Float {
        val dx = maxOf(0f, b.left - a.right, a.left - b.right)
        val dy = maxOf(0f, b.top - a.bottom, a.top - b.bottom)
        return hypot(dx, dy)
    }
}
