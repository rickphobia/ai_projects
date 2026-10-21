package com.rickphobia.ricknotes.core.touch

/**
 * The limits that tell a resting hand from a finger and a tap from a scroll, in one place so they
 * can be tuned on the tablet. Sizes are millimetres on the screen, so they mean the same on any
 * screen density.
 */
data class TouchThresholds(
    /** Fingers are ignored for this long after the pen was last touching or hovering. */
    val penLockoutMs: Long = 500,
    /** A contact wider than this is a palm or the side of a hand, not a fingertip. */
    val maxFingertipMm: Float = 20f,
    /** A tap lasts at most this long, from the first finger down to the last one up. */
    val tapMaxMs: Long = 300,
    /** A tap's fingers each move at most this far. */
    val tapSlopMm: Float = 3f,
)
