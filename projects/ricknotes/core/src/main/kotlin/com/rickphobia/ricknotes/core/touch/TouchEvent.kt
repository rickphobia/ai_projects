package com.rickphobia.ricknotes.core.touch

enum class PointerKind { PEN, FINGER }

/**
 * [HOVER] is the pen in range above the screen without touching it, and [HOVER_EXIT] the pen
 * leaving that range (or touching down). [CANCEL] is a touch Android decided was unintended, such
 * as a palm, or a gesture it took away.
 */
enum class TouchPhase { DOWN, MOVE, UP, CANCEL, HOVER, HOVER_EXIT }

/**
 * One pointer's change, as plain values the app makes from Android's touch events. [x] and [y] are
 * screen pixels, [pressure] runs from 0 to 1 and [timeMs] is the event's time on a steady clock.
 * [contactPx] is how wide the touch is on the screen, in pixels; 0 when the screen doesn't say.
 */
data class TouchEvent(
    val pointerId: Int,
    val kind: PointerKind,
    val phase: TouchPhase,
    val x: Float,
    val y: Float,
    val pressure: Float,
    val contactPx: Float,
    val timeMs: Long,
)

/** What a touch means for the open Document. Positions are screen pixels. */
sealed interface TouchAction {
    /** The pen touched down. Any finger's erase still going is called off, and nothing it touched is erased. */
    data class StartStroke(
        val pointerId: Int,
        val x: Float,
        val y: Float,
    ) : TouchAction

    data class ExtendStroke(
        val pointerId: Int,
        val x: Float,
        val y: Float,
    ) : TouchAction

    data class EndStroke(
        val pointerId: Int,
    ) : TouchAction

    /** The stroke is dropped: Android cancelled the pen's touch. */
    data class CancelStroke(
        val pointerId: Int,
    ) : TouchAction

    /** One finger touched down with Finger erase on: it erases the strokes it touches from here. */
    data class StartErase(
        val pointerId: Int,
        val x: Float,
        val y: Float,
    ) : TouchAction

    data class ExtendErase(
        val pointerId: Int,
        val x: Float,
        val y: Float,
    ) : TouchAction

    /** The erasing finger lifted: what it touched is erased, as one undo step. */
    data class EndErase(
        val pointerId: Int,
    ) : TouchAction

    /** The finger's erase is called off and what it touched stays: it turned out not to be an erase. */
    data class CancelErase(
        val pointerId: Int,
    ) : TouchAction

    /** Fingers touched down: anything still moving the view (a fling) should stop. */
    data object ScrollStart : TouchAction

    /** One finger moved by ([dx], [dy]): the pages follow it. */
    data class Scroll(
        val dx: Float,
        val dy: Float,
        val timeMs: Long,
    ) : TouchAction

    /**
     * Two or more fingers moved: zoom by [zoomChange] about ([focusX], [focusY]), the point between
     * them, and follow that point's move of ([moveX], [moveY]).
     */
    data class Pinch(
        val focusX: Float,
        val focusY: Float,
        val zoomChange: Float,
        val moveX: Float,
        val moveY: Float,
    ) : TouchAction

    /** The last finger lifted: the view may carry on with a fling. */
    data object ScrollEnd : TouchAction

    /** A two-finger tap with its switch on. */
    data object Undo : TouchAction

    /** A three-finger tap with its switch on. */
    data object Redo : TouchAction

    /** A finger touch taken for a resting hand, ignored until it lifts. [reason] says why, for the log. */
    data class Reject(
        val pointerId: Int,
        val reason: String,
    ) : TouchAction

    data object Ignore : TouchAction
}
