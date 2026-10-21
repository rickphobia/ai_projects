package com.rickphobia.ricknotes.core.touch

import kotlin.math.hypot

private const val UNDO_TAP_FINGERS = 2
private const val REDO_TAP_FINGERS = 3

/**
 * Turns touches on an open Document into what they mean: the pen draws, one finger scrolls (or
 * erases, with Finger erase on), two or more fingers scroll and zoom, and two- and three-finger
 * taps undo and redo when switched on in [gestures]. A finger never draws.
 *
 * A resting hand must never mark or erase, so fingers [HandRejection] takes for one are ignored
 * until they lift. A finger already down when the pen comes near does nothing until the pen has
 * gone; an erase it was making is called off.
 *
 * One interpreter per open Document; it remembers which pointers are down between events.
 * [pixelsPerMm] is the screen's density, to turn [thresholds]' millimetres into pixels.
 */
class TouchInterpreter(
    private val gestures: FingerGestures,
    thresholds: TouchThresholds,
    pixelsPerMm: Float,
) {
    private var penPointer: Int? = null
    private val hand = HandRejection(thresholds, pixelsPerMm)
    private val tap = TapTracker(thresholds.tapMaxMs, thresholds.tapSlopMm * pixelsPerMm)

    // Every counted finger that is down, with where it last was. Kept up to date even while the pen
    // is near, so a finger that carries on after the pen has gone moves the view from where it is.
    private val fingers = LinkedHashMap<Int, Position>()

    // The finger erasing with Finger erase on, if one is.
    private var eraser: Int? = null

    fun handle(event: TouchEvent): TouchAction =
        when (event.kind) {
            PointerKind.PEN -> handlePen(event)
            PointerKind.FINGER -> handleFinger(event)
        }

    // The pen showing up calls off a finger's erase right away, even if that finger is lying still
    // and sends nothing more until it lifts: it may be the hand that holds the pen.
    private fun handlePen(event: TouchEvent): TouchAction {
        hand.penSeen(event)
        val calledOff = callOffErase()
        val drawing = penPointer
        return when {
            calledOff != null && event.phase != TouchPhase.DOWN -> {
                calledOff
            }

            event.phase == TouchPhase.DOWN && drawing == null -> {
                penPointer = event.pointerId
                TouchAction.StartStroke(event.pointerId, event.x, event.y)
            }

            event.pointerId != drawing -> {
                TouchAction.Ignore
            }

            event.phase == TouchPhase.MOVE -> {
                TouchAction.ExtendStroke(event.pointerId, event.x, event.y)
            }

            event.phase == TouchPhase.UP -> {
                penPointer = null
                TouchAction.EndStroke(event.pointerId)
            }

            event.phase == TouchPhase.CANCEL -> {
                penPointer = null
                TouchAction.CancelStroke(event.pointerId)
            }

            else -> {
                TouchAction.Ignore
            }
        }
    }

    private fun handleFinger(event: TouchEvent): TouchAction =
        when {
            event.phase == TouchPhase.HOVER || event.phase == TouchPhase.HOVER_EXIT -> TouchAction.Ignore
            hand.alreadyRejected(event) -> TouchAction.Ignore
            else -> hand.rejectionReason(event)?.let { reject(event.pointerId, it) } ?: handleCountedFinger(event)
        }

    /** Ends the finger erase going on, if there is one: the action that says so, or null. */
    private fun callOffErase(): TouchAction.CancelErase? {
        val erasing = eraser ?: return null
        eraser = null
        return TouchAction.CancelErase(erasing)
    }

    // A finger already counted can be rejected too, when it spreads into a palm. Whatever it was
    // doing stops: the view no longer follows it, and the app calls off an erase it was making.
    private fun reject(
        id: Int,
        reason: String,
    ): TouchAction {
        fingers.remove(id)
        tap.spoil()
        if (eraser == id) eraser = null
        return TouchAction.Reject(id, reason)
    }

    // A finger that isn't a resting hand.
    private fun handleCountedFinger(event: TouchEvent): TouchAction {
        val before = fingers.toMap()
        when (event.phase) {
            TouchPhase.DOWN -> {
                fingers[event.pointerId] = Position(event.x, event.y)
                tap.down(event, fingers.size)
            }

            TouchPhase.MOVE -> {
                fingers[event.pointerId] = Position(event.x, event.y)
                tap.move(event)
            }

            else -> {
                // A finger can lift far from its last move.
                if (event.phase == TouchPhase.UP) tap.move(event)
                fingers.remove(event.pointerId)
            }
        }
        if (hand.penNear(event.timeMs)) {
            tap.spoil()
            return callOffErase() ?: TouchAction.Ignore
        }
        return when (event.phase) {
            TouchPhase.DOWN -> down(before, event)
            TouchPhase.MOVE -> move(before, event)
            TouchPhase.UP -> up(event)
            else -> cancel(event)
        }
    }

    private fun down(
        before: Map<Int, Position>,
        event: TouchEvent,
    ): TouchAction =
        when {
            before.isEmpty() && gestures.fingerErase -> {
                eraser = event.pointerId
                TouchAction.StartErase(event.pointerId, event.x, event.y)
            }

            before.isEmpty() -> {
                TouchAction.ScrollStart
            }

            // A second finger: this is a scroll or zoom (or a tap), not an erase after all.
            else -> {
                callOffErase() ?: TouchAction.Ignore
            }
        }

    private fun move(
        before: Map<Int, Position>,
        event: TouchEvent,
    ): TouchAction {
        val last = before[event.pointerId]
        return when {
            eraser == event.pointerId -> TouchAction.ExtendErase(event.pointerId, event.x, event.y)
            last == null -> TouchAction.Ignore
            fingers.size == 1 -> TouchAction.Scroll(event.x - last.x, event.y - last.y, event.timeMs)
            else -> pinch(before.values, fingers.values)
        }
    }

    private fun up(event: TouchEvent): TouchAction {
        val tapped = if (fingers.isEmpty()) tap.fingersTapped(event.timeMs) else 0
        return when {
            eraser == event.pointerId -> {
                eraser = null
                TouchAction.EndErase(event.pointerId)
            }

            fingers.isNotEmpty() -> {
                TouchAction.Ignore
            }

            tapped == UNDO_TAP_FINGERS && gestures.twoFingerTapUndo -> {
                TouchAction.Undo
            }

            tapped == REDO_TAP_FINGERS && gestures.threeFingerTapRedo -> {
                TouchAction.Redo
            }

            else -> {
                TouchAction.ScrollEnd
            }
        }
    }

    private fun cancel(event: TouchEvent): TouchAction {
        tap.spoil()
        val erased = if (eraser == event.pointerId) callOffErase() else null
        return erased ?: TouchAction.Ignore
    }
}

private data class Position(
    val x: Float,
    val y: Float,
)

/** The fingers moved from [before] to [after]: how far apart they spread and where their centre went. */
private fun pinch(
    before: Collection<Position>,
    after: Collection<Position>,
): TouchAction.Pinch {
    val oldCentre = centre(before)
    val newCentre = centre(after)
    val oldSpread = spread(before, oldCentre)
    val newSpread = spread(after, newCentre)
    return TouchAction.Pinch(
        focusX = newCentre.x,
        focusY = newCentre.y,
        zoomChange = if (oldSpread > 0f && newSpread > 0f) newSpread / oldSpread else 1f,
        moveX = newCentre.x - oldCentre.x,
        moveY = newCentre.y - oldCentre.y,
    )
}

private fun centre(positions: Collection<Position>): Position =
    Position(positions.map { it.x }.average().toFloat(), positions.map { it.y }.average().toFloat())

/** The fingers' average distance from their centre: how far apart they are. */
private fun spread(
    positions: Collection<Position>,
    centre: Position,
): Float = positions.map { hypot(it.x - centre.x, it.y - centre.y) }.average().toFloat()
