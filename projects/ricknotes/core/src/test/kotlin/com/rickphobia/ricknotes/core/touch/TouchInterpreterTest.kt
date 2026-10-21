package com.rickphobia.ricknotes.core.touch

import com.rickphobia.ricknotes.core.touch.PointerKind.FINGER
import com.rickphobia.ricknotes.core.touch.PointerKind.PEN
import com.rickphobia.ricknotes.core.touch.TouchPhase.CANCEL
import com.rickphobia.ricknotes.core.touch.TouchPhase.DOWN
import com.rickphobia.ricknotes.core.touch.TouchPhase.HOVER
import com.rickphobia.ricknotes.core.touch.TouchPhase.HOVER_EXIT
import com.rickphobia.ricknotes.core.touch.TouchPhase.MOVE
import com.rickphobia.ricknotes.core.touch.TouchPhase.UP
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TouchInterpreterTest {
    private var interpreter = TouchInterpreter(FingerGestures(), TouchThresholds(), PX_PER_MM)
    private var clock = 0L

    private fun withGestures(gestures: FingerGestures) {
        interpreter = TouchInterpreter(gestures, TouchThresholds(), PX_PER_MM)
    }

    // Each event comes one frame after the one before.
    private fun nextFrame(): Long {
        clock += FRAME_MS
        return clock
    }

    private fun pen(
        phase: TouchPhase,
        x: Float,
        y: Float,
    ) = interpreter.handle(TouchEvent(PEN_ID, PEN, phase, x, y, 0.5f, 0f, nextFrame()))

    private fun finger(
        id: Int,
        phase: TouchPhase,
        x: Float,
        y: Float,
        contactPx: Float = FINGERTIP_PX,
    ) = interpreter.handle(TouchEvent(id, FINGER, phase, x, y, 1f, contactPx, nextFrame()))

    /** A pen stroke, then the pen leaving hover range, then [afterMs] with nothing touching. */
    private fun penStrokeThenWait(afterMs: Long) {
        pen(HOVER, 10f, 20f)
        pen(HOVER_EXIT, 10f, 20f)
        pen(DOWN, 10f, 20f)
        pen(UP, 10f, 20f)
        pen(HOVER, 10f, 20f)
        pen(HOVER_EXIT, 10f, 20f)
        clock += afterMs
    }

    private fun tap(vararg ids: Int): List<TouchAction> =
        ids.map { finger(it, DOWN, 100f * it, 500f) } + ids.map { finger(it, UP, 100f * it, 500f) }

    @Test
    fun `the pen draws a stroke from down to up`() {
        assertEquals(TouchAction.StartStroke(PEN_ID, 10f, 20f), pen(DOWN, 10f, 20f))
        assertEquals(TouchAction.ExtendStroke(PEN_ID, 15f, 25f), pen(MOVE, 15f, 25f))
        assertEquals(TouchAction.EndStroke(PEN_ID), pen(UP, 15f, 25f))
    }

    @Test
    fun `a cancelled pen drops its stroke`() {
        pen(DOWN, 10f, 20f)

        assertEquals(TouchAction.CancelStroke(PEN_ID), pen(CANCEL, 10f, 20f))
    }

    @Test
    fun `one finger scrolls by how far it moved and never draws`() {
        val actions =
            listOf(
                finger(1, DOWN, 100f, 500f),
                finger(1, MOVE, 104f, 470f),
                finger(1, MOVE, 104f, 430f),
                finger(1, UP, 104f, 430f),
            )

        assertEquals(TouchAction.ScrollStart, actions[0])
        assertEquals(TouchAction.Scroll(4f, -30f, 2 * FRAME_MS), actions[1])
        assertEquals(TouchAction.Scroll(0f, -40f, 3 * FRAME_MS), actions[2])
        assertEquals(TouchAction.ScrollEnd, actions[3])
        assertTrue(actions.none { it is TouchAction.StartStroke || it is TouchAction.ExtendStroke })
    }

    @Test
    fun `two fingers spreading apart zoom in about the point between them`() {
        finger(1, DOWN, 100f, 500f)
        finger(2, DOWN, 300f, 500f)

        val pinch = finger(2, MOVE, 500f, 500f) as TouchAction.Pinch

        // The fingers were 200 px apart and now are 400 px: twice as far.
        assertEquals(2f, pinch.zoomChange, TOLERANCE)
        assertEquals(300f, pinch.focusX, TOLERANCE)
        assertEquals(500f, pinch.focusY, TOLERANCE)
    }

    @Test
    fun `two fingers moving together scroll without zooming`() {
        finger(1, DOWN, 100f, 500f)
        finger(2, DOWN, 300f, 500f)

        val first = finger(1, MOVE, 100f, 440f) as TouchAction.Pinch
        val second = finger(2, MOVE, 300f, 440f) as TouchAction.Pinch

        // Each finger's move shifts the point between them by half of it.
        assertEquals(-30f, first.moveY, TOLERANCE)
        assertEquals(-30f, second.moveY, TOLERANCE)
        assertEquals(1f, second.zoomChange * first.zoomChange, TOLERANCE)
    }

    @Test
    fun `lifting one of two fingers carries on scrolling from where the other one is`() {
        finger(1, DOWN, 100f, 500f)
        finger(2, DOWN, 300f, 500f)
        finger(2, MOVE, 300f, 450f)

        assertEquals(TouchAction.Ignore, finger(2, UP, 300f, 450f))
        assertEquals(TouchAction.Scroll(0f, -20f, 5 * FRAME_MS), finger(1, MOVE, 100f, 480f))
    }

    @Test
    fun `a finger while the pen draws neither scrolls nor stops the stroke`() {
        pen(DOWN, 10f, 20f)

        assertTrue(finger(1, DOWN, 500f, 500f) is TouchAction.Reject)
        assertEquals(TouchAction.Ignore, finger(1, MOVE, 500f, 400f))
        assertEquals(TouchAction.ExtendStroke(PEN_ID, 12f, 22f), pen(MOVE, 12f, 22f))
        assertEquals(TouchAction.EndStroke(PEN_ID), pen(UP, 12f, 22f))
    }

    @Test
    fun `a finger that lands while the pen draws stays ignored after the pen lifts`() {
        pen(DOWN, 10f, 20f)
        assertTrue(finger(1, DOWN, 500f, 500f) is TouchAction.Reject)
        pen(UP, 10f, 20f)
        clock += LONG_AFTER_MS

        assertEquals(TouchAction.Ignore, finger(1, MOVE, 500f, 390f))
        assertEquals(TouchAction.Ignore, finger(1, UP, 500f, 390f))
    }

    @Test
    fun `a finger still down when the pen lifts carries on scrolling once the lockout ends, with no jump`() {
        finger(1, DOWN, 500f, 500f)
        pen(DOWN, 10f, 20f)
        finger(1, MOVE, 500f, 400f)
        pen(UP, 10f, 20f)
        clock += LONG_AFTER_MS

        assertEquals(TouchAction.Scroll(0f, -10f, clock + FRAME_MS), finger(1, MOVE, 500f, 390f))
    }

    @Test
    fun `the pen landing mid-scroll draws, and the scroll stops`() {
        finger(1, DOWN, 500f, 500f)
        finger(1, MOVE, 500f, 450f)

        assertEquals(TouchAction.StartStroke(PEN_ID, 10f, 20f), pen(DOWN, 10f, 20f))
        assertEquals(TouchAction.Ignore, finger(1, MOVE, 500f, 400f))
    }

    @Test
    fun `a cancelled finger ends its scroll without a fling`() {
        finger(1, DOWN, 500f, 500f)
        finger(1, MOVE, 500f, 450f)

        assertEquals(TouchAction.Ignore, finger(1, CANCEL, 500f, 450f))
        assertEquals(TouchAction.ScrollStart, finger(2, DOWN, 300f, 300f))
    }

    @Test
    fun `a pen move with no stroke started is ignored`() {
        assertEquals(TouchAction.Ignore, pen(MOVE, 10f, 20f))
        assertEquals(TouchAction.Ignore, pen(UP, 10f, 20f))
    }

    @Test
    fun `a palm landing 200 ms after the pen lifts is ignored for as long as it rests`() {
        penStrokeThenWait(afterMs = 200)

        assertTrue(finger(1, DOWN, 500f, 500f) is TouchAction.Reject)
        clock += LONG_AFTER_MS
        assertEquals(TouchAction.Ignore, finger(1, MOVE, 500f, 300f))
        assertEquals(TouchAction.Ignore, finger(1, UP, 500f, 300f))
    }

    @Test
    fun `a finger well after the pen left scrolls again`() {
        penStrokeThenWait(afterMs = LONG_AFTER_MS)

        assertEquals(TouchAction.ScrollStart, finger(1, DOWN, 500f, 500f))
    }

    @Test
    fun `fingers are ignored while the pen hovers, however long it hovers`() {
        pen(HOVER, 10f, 20f)
        clock += 5_000

        assertTrue(finger(1, DOWN, 500f, 500f) is TouchAction.Reject)
    }

    @Test
    fun `a contact wider than a fingertip is ignored and the finger beside it still scrolls`() {
        val palm = finger(1, DOWN, 500f, 500f, contactPx = PALM_PX)

        assertEquals(TouchAction.Reject(1, "contact 25.0 mm is wider than a fingertip (15.0 mm)"), palm)
        assertEquals(TouchAction.ScrollStart, finger(2, DOWN, 100f, 500f))
        assertEquals(TouchAction.Ignore, finger(1, MOVE, 520f, 480f, contactPx = PALM_PX))
        assertEquals(TouchAction.Scroll(0f, -50f, clock + FRAME_MS), finger(2, MOVE, 100f, 450f))
    }

    @Test
    fun `a finger that spreads into a palm stops counting`() {
        finger(1, DOWN, 500f, 500f)
        finger(1, MOVE, 500f, 480f)

        assertTrue(finger(1, MOVE, 500f, 470f, contactPx = PALM_PX) is TouchAction.Reject)
        assertEquals(TouchAction.Ignore, finger(1, MOVE, 500f, 400f, contactPx = FINGERTIP_PX))
    }

    @Test
    fun `a screen that reports no contact size never rejects for size`() {
        assertEquals(TouchAction.ScrollStart, finger(1, DOWN, 500f, 500f, contactPx = 0f))
    }

    @Test
    fun `with Finger erase on, one finger erases instead of scrolling`() {
        withGestures(FingerGestures(fingerErase = true))

        assertEquals(TouchAction.StartErase(1, 500f, 500f), finger(1, DOWN, 500f, 500f))
        assertEquals(TouchAction.ExtendErase(1, 500f, 450f), finger(1, MOVE, 500f, 450f))
        assertEquals(TouchAction.EndErase(1), finger(1, UP, 500f, 450f))
    }

    @Test
    fun `with Finger erase off, one finger never erases`() {
        val actions = listOf(finger(1, DOWN, 500f, 500f), finger(1, MOVE, 500f, 450f), finger(1, UP, 500f, 450f))

        assertTrue(actions.none { it is TouchAction.StartErase || it is TouchAction.ExtendErase })
    }

    @Test
    fun `with Finger erase on, two fingers still scroll and zoom, and the first finger's erase is called off`() {
        withGestures(FingerGestures(fingerErase = true))
        finger(1, DOWN, 100f, 500f)

        assertEquals(TouchAction.CancelErase(1), finger(2, DOWN, 300f, 500f))
        assertTrue(finger(2, MOVE, 300f, 440f) is TouchAction.Pinch)
        assertTrue(finger(1, MOVE, 100f, 440f) is TouchAction.Pinch)
    }

    @Test
    fun `a cancelled erasing finger erases nothing`() {
        withGestures(FingerGestures(fingerErase = true))
        finger(1, DOWN, 500f, 500f)

        assertEquals(TouchAction.CancelErase(1), finger(1, CANCEL, 500f, 500f))
    }

    @Test
    fun `the pen arriving while a finger erases calls the erase off`() {
        withGestures(FingerGestures(fingerErase = true))
        finger(1, DOWN, 500f, 500f)

        assertEquals(TouchAction.CancelErase(1), pen(HOVER, 10f, 20f))
        assertEquals(TouchAction.Ignore, finger(1, MOVE, 500f, 450f))
        assertEquals(TouchAction.Ignore, finger(1, MOVE, 500f, 400f))
        assertEquals(TouchAction.Ignore, finger(1, UP, 500f, 400f))
    }

    @Test
    fun `a still finger that was erasing when the pen landed never finishes its erase`() {
        withGestures(FingerGestures(fingerErase = true))
        finger(1, DOWN, 500f, 500f)
        pen(DOWN, 10f, 20f)
        pen(UP, 10f, 20f)
        clock += LONG_AFTER_MS

        assertTrue(finger(1, UP, 500f, 500f) !is TouchAction.EndErase)
    }

    @Test
    fun `the pen touching down without a hover exit doesn't leave fingers locked out`() {
        pen(HOVER, 10f, 20f)
        pen(DOWN, 10f, 20f)
        pen(UP, 10f, 20f)
        clock += LONG_AFTER_MS

        assertEquals(TouchAction.ScrollStart, finger(1, DOWN, 500f, 500f))
    }

    @Test
    fun `two fingers that lift far from where they landed are not a tap`() {
        withGestures(FingerGestures(twoFingerTapUndo = true))
        finger(1, DOWN, 100f, 500f)
        finger(2, DOWN, 300f, 500f)
        finger(1, UP, 100f, 700f)

        assertEquals(TouchAction.ScrollEnd, finger(2, UP, 300f, 700f))
    }

    @Test
    fun `a two-finger tap undoes and a three-finger tap redoes when switched on`() {
        withGestures(FingerGestures(twoFingerTapUndo = true, threeFingerTapRedo = true))

        assertEquals(TouchAction.Undo, tap(1, 2).last())
        assertEquals(TouchAction.Redo, tap(1, 2, 3).last())
    }

    @Test
    fun `taps do nothing with their switches off`() {
        assertEquals(TouchAction.ScrollEnd, tap(1, 2).last())
        assertEquals(TouchAction.ScrollEnd, tap(1, 2, 3).last())
    }

    @Test
    fun `each tap has its own switch`() {
        withGestures(FingerGestures(threeFingerTapRedo = true))

        assertEquals(TouchAction.ScrollEnd, tap(1, 2).last())
        assertEquals(TouchAction.Redo, tap(1, 2, 3).last())
    }

    @Test
    fun `a two-finger tap undoes with Finger erase on, and erases nothing`() {
        withGestures(FingerGestures(fingerErase = true, twoFingerTapUndo = true))

        val actions = tap(1, 2)

        assertEquals(TouchAction.CancelErase(1), actions[1])
        assertEquals(TouchAction.Undo, actions.last())
        assertTrue(actions.none { it is TouchAction.EndErase })
    }

    @Test
    fun `two fingers that move are a scroll, not a tap`() {
        withGestures(FingerGestures(twoFingerTapUndo = true))
        finger(1, DOWN, 100f, 500f)
        finger(2, DOWN, 300f, 500f)
        finger(2, MOVE, 300f, 500f + 4 * PX_PER_MM)
        finger(1, UP, 100f, 500f)

        assertEquals(TouchAction.ScrollEnd, finger(2, UP, 300f, 500f + 4 * PX_PER_MM))
    }

    @Test
    fun `two fingers held too long are not a tap`() {
        withGestures(FingerGestures(twoFingerTapUndo = true))
        finger(1, DOWN, 100f, 500f)
        finger(2, DOWN, 300f, 500f)
        clock += 400
        finger(1, UP, 100f, 500f)

        assertEquals(TouchAction.ScrollEnd, finger(2, UP, 300f, 500f))
    }

    @Test
    fun `a finger tapping beside a resting palm is not a two-finger tap`() {
        withGestures(FingerGestures(twoFingerTapUndo = true))
        finger(1, DOWN, 500f, 500f, contactPx = PALM_PX)
        finger(2, DOWN, 100f, 500f)

        assertEquals(TouchAction.ScrollEnd, finger(2, UP, 100f, 500f))
    }

    @Test
    fun `with the pen and a finger at once, the pen draws and the finger does nothing`() {
        withGestures(FingerGestures(fingerErase = true, twoFingerTapUndo = true))

        assertEquals(TouchAction.StartStroke(PEN_ID, 10f, 20f), pen(DOWN, 10f, 20f))
        assertTrue(finger(1, DOWN, 500f, 500f) is TouchAction.Reject)
        assertEquals(TouchAction.ExtendStroke(PEN_ID, 12f, 22f), pen(MOVE, 12f, 22f))
        assertEquals(TouchAction.Ignore, finger(1, UP, 500f, 500f))
        assertEquals(TouchAction.EndStroke(PEN_ID), pen(UP, 12f, 22f))
    }

    private companion object {
        const val PEN_ID = 0
        const val FRAME_MS = 8L
        const val TOLERANCE = 0.001f
        const val PX_PER_MM = 10f
        const val FINGERTIP_PX = 8 * PX_PER_MM
        const val PALM_PX = 25 * PX_PER_MM

        // Well past the lockout after the pen.
        const val LONG_AFTER_MS = 1_000L
    }
}
