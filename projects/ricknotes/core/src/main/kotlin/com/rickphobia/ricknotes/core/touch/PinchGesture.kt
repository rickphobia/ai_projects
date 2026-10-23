package com.rickphobia.ricknotes.core.touch

import kotlin.math.abs
import kotlin.math.hypot

/**
 * Turns two or more fingers' moves into [TouchAction.Pinch]es that scroll, and zoom only once the
 * fingers have clearly spread apart or pinched together: by [slopPx] in distance since they
 * landed. From then on the zoom follows them for the rest of the touch.
 *
 * Android reports each finger's move on its own, and fingers swiping together never stay exactly
 * the same distance apart, so their spread wobbles every frame even when nobody means to zoom.
 */
internal class PinchGesture(
    private val slopPx: Float,
) {
    // The fingers' distance apart when the current set of fingers was complete; null before then.
    private var landedDistance: Float? = null
    private var zooming = false

    /** The fingers changed (one landed, lifted or was rejected): measure the dead zone from here. */
    fun restart() {
        landedDistance = null
        zooming = false
    }

    /** The fingers moved from [before] to [after]: how far apart they spread and where their centre went. */
    fun move(
        before: Collection<Position>,
        after: Collection<Position>,
    ): TouchAction.Pinch {
        val oldCentre = centre(before)
        val newCentre = centre(after)
        val oldSpread = spread(before, oldCentre)
        val newSpread = spread(after, newCentre)
        val landed = landedDistance ?: (2 * oldSpread).also { landedDistance = it }
        if (abs(2 * newSpread - landed) > slopPx) zooming = true
        return TouchAction.Pinch(
            focusX = newCentre.x,
            focusY = newCentre.y,
            zoomChange = if (zooming && oldSpread > 0f && newSpread > 0f) newSpread / oldSpread else 1f,
            moveX = newCentre.x - oldCentre.x,
            moveY = newCentre.y - oldCentre.y,
        )
    }
}

internal data class Position(
    val x: Float,
    val y: Float,
)

private fun centre(positions: Collection<Position>): Position =
    Position(positions.map { it.x }.average().toFloat(), positions.map { it.y }.average().toFloat())

/** The fingers' average distance from their centre: how far apart they are. */
private fun spread(
    positions: Collection<Position>,
    centre: Position,
): Float = positions.map { hypot(it.x - centre.x, it.y - centre.y) }.average().toFloat()
