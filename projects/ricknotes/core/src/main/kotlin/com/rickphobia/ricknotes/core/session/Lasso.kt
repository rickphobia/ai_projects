package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePoint
import com.rickphobia.ricknotes.core.ink.Stroke

// Fewer corners than this can't enclose anything.
private const val MIN_LOOP_POINTS = 3

/** How far a Lasso selection is moved, in PDF points: right and down are positive. */
data class PageOffset(
    val dx: Float,
    val dy: Float,
) {
    val isZero: Boolean get() = dx == 0f && dy == 0f
}

/** A rectangle on a page, in PDF points from its top-left corner. */
data class PageRect(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
) {
    operator fun contains(point: PagePoint): Boolean = point.x in left..right && point.y in top..bottom

    fun movedBy(offset: PageOffset): PageRect =
        PageRect(left + offset.dx, top + offset.dy, right + offset.dx, bottom + offset.dy)

    fun grownBy(marginPt: Float): PageRect =
        PageRect(
            left - marginPt,
            top - marginPt,
            right + marginPt,
            bottom + marginPt,
        )

    /**
     * [offset], cut short so this rectangle stays on a [widthPt] x [heightPt] page. One already past
     * an edge may stay there or come back, but not go further out.
     */
    fun keepOnPage(
        offset: PageOffset,
        widthPt: Float,
        heightPt: Float,
    ): PageOffset =
        PageOffset(
            offset.dx.coerceIn(minOf(-left, 0f), maxOf(widthPt - right, 0f)),
            offset.dy.coerceIn(minOf(-top, 0f), maxOf(heightPt - bottom, 0f)),
        )
}

/**
 * The strokes on [pageId] that the Lasso's [loop] selects. The loop closes itself from its last
 * point back to its first. A stroke is selected when more than half its points are inside, so a
 * loop drawn a little tight round a block of working still gets the strokes it cuts across.
 */
fun strokesInLoop(
    strokes: List<Stroke>,
    pageId: PageId,
    loop: List<PagePoint>,
): List<Stroke> {
    if (loop.size < MIN_LOOP_POINTS) return emptyList()
    return strokes.filter { stroke ->
        stroke.pageId == pageId && stroke.points.count { inside(PagePoint(it.x, it.y), loop) } * 2 > stroke.points.size
    }
}

/** The smallest rectangle holding all of [strokes] at their full width, or null if there are none. */
fun boundsOf(strokes: List<Stroke>): PageRect? {
    if (strokes.isEmpty()) return null
    val edges =
        strokes.flatMap { stroke ->
            val half = stroke.widthPt / 2
            stroke.points.map { PageRect(it.x - half, it.y - half, it.x + half, it.y + half) }
        }
    return PageRect(
        edges.minOf { it.left },
        edges.minOf { it.top },
        edges.maxOf { it.right },
        edges.maxOf { it.bottom },
    )
}

/** This stroke [offset] across its page: the same stroke, with the same ID, somewhere else. */
fun Stroke.movedBy(offset: PageOffset): Stroke =
    copy(points = points.map { it.copy(x = it.x + offset.dx, y = it.y + offset.dy) })

// Even-odd rule: a ray going right from [point] crosses the loop's edges an odd number of times
// if and only if [point] is inside.
private fun inside(
    point: PagePoint,
    loop: List<PagePoint>,
): Boolean {
    var crossings = 0
    loop.forEachIndexed { i, a ->
        val b = loop[(i + 1) % loop.size]
        if ((a.y > point.y) != (b.y > point.y)) {
            val crossX = a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y)
            if (point.x < crossX) crossings++
        }
    }
    return crossings % 2 == 1
}
