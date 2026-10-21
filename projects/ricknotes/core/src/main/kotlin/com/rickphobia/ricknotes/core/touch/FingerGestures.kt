package com.rickphobia.ricknotes.core.touch

/** The finger gestures the student switched on in Settings. Each is off until they do. */
data class FingerGestures(
    /** One finger erases whole strokes instead of scrolling. */
    val fingerErase: Boolean = false,
    val twoFingerTapUndo: Boolean = false,
    val threeFingerTapRedo: Boolean = false,
)
