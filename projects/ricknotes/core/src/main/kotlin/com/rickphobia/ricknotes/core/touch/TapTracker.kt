package com.rickphobia.ricknotes.core.touch

import kotlin.math.hypot

/**
 * Watches one finger gesture, from the first finger down to the last one up, to tell whether it was
 * a tap: short, with no finger moving more than [slopPx], and nothing spoiling it on the way.
 */
internal class TapTracker(
    private val maxMs: Long,
    private val slopPx: Float,
) {
    private var startMs = 0L
    private val downAt = mutableMapOf<Int, Pair<Float, Float>>()
    private var most = 0
    private var spoiled = false

    /** A finger counted by the gesture touched down; [fingersDown] is how many are down now. */
    fun down(
        event: TouchEvent,
        fingersDown: Int,
    ) {
        if (fingersDown == 1) {
            startMs = event.timeMs
            downAt.clear()
            most = 0
            spoiled = false
        }
        downAt[event.pointerId] = event.x to event.y
        most = maxOf(most, fingersDown)
    }

    fun move(event: TouchEvent) {
        val (x, y) = downAt[event.pointerId] ?: return
        if (hypot(event.x - x, event.y - y) > slopPx) spoiled = true
    }

    /** Something other than a clean tap happened: a cancel, a palm, the pen coming near. */
    fun spoil() {
        spoiled = true
    }

    /** The last finger lifted at [timeMs]: how many fingers tapped, or 0 if it wasn't a tap. */
    fun fingersTapped(timeMs: Long): Int = if (spoiled || timeMs - startMs > maxMs) 0 else most
}
