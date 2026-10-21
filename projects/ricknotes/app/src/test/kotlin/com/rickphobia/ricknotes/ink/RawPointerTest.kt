package com.rickphobia.ricknotes.ink

import android.view.MotionEvent
import com.rickphobia.ricknotes.core.touch.PointerKind
import com.rickphobia.ricknotes.core.touch.TouchEvent
import com.rickphobia.ricknotes.core.touch.TouchPhase
import org.junit.Assert.assertEquals
import org.junit.Test

class RawPointerTest {
    private val pen =
        RawPointer(id = 0, MotionEvent.TOOL_TYPE_STYLUS, x = 10f, y = 20f, pressure = 0.4f, touchMajor = 0f)
    private val finger =
        RawPointer(id = 1, MotionEvent.TOOL_TYPE_FINGER, x = 300f, y = 400f, pressure = 1f, touchMajor = 60f)

    private fun events(
        action: Int,
        actionIndex: Int = 0,
        cancelled: Boolean = false,
        vararg pointers: RawPointer,
    ) = touchEventsOf(action, actionIndex, cancelled, TIME_MS, pointers.toList())

    @Test
    fun `a stylus touching down is the pen going down`() {
        assertEquals(
            listOf(TouchEvent(0, PointerKind.PEN, TouchPhase.DOWN, 10f, 20f, 0.4f, 0f, TIME_MS)),
            events(MotionEvent.ACTION_DOWN, pointers = arrayOf(pen)),
        )
    }

    @Test
    fun `a second pointer going down reports only that pointer`() {
        val down = events(MotionEvent.ACTION_POINTER_DOWN, actionIndex = 1, pointers = arrayOf(pen, finger))

        assertEquals(listOf(1), down.map { it.pointerId })
        assertEquals(PointerKind.FINGER, down.single().kind)
    }

    @Test
    fun `a move reports every pointer`() {
        val moves = events(MotionEvent.ACTION_MOVE, pointers = arrayOf(pen, finger))

        assertEquals(listOf(TouchPhase.MOVE, TouchPhase.MOVE), moves.map { it.phase })
    }

    @Test
    fun `a pointer Android lifts as unintended is cancelled, not finished`() {
        val up =
            events(MotionEvent.ACTION_POINTER_UP, actionIndex = 1, cancelled = true, pointers = arrayOf(pen, finger))

        assertEquals(TouchEvent(1, PointerKind.FINGER, TouchPhase.CANCEL, 300f, 400f, 1f, 60f, TIME_MS), up.single())
    }

    @Test
    fun `the contact size is passed through`() {
        assertEquals(60f, events(MotionEvent.ACTION_DOWN, pointers = arrayOf(finger)).single().contactPx)
    }

    @Test
    fun `the pen hovering and leaving are hover events`() {
        assertEquals(TouchPhase.HOVER, events(MotionEvent.ACTION_HOVER_ENTER, pointers = arrayOf(pen)).single().phase)
        assertEquals(TouchPhase.HOVER, events(MotionEvent.ACTION_HOVER_MOVE, pointers = arrayOf(pen)).single().phase)
        assertEquals(
            TouchPhase.HOVER_EXIT,
            events(MotionEvent.ACTION_HOVER_EXIT, pointers = arrayOf(pen)).single().phase,
        )
    }

    @Test
    fun `a mouse is not a pen`() {
        val mouse = pen.copy(toolType = MotionEvent.TOOL_TYPE_MOUSE)

        assertEquals(PointerKind.FINGER, events(MotionEvent.ACTION_DOWN, pointers = arrayOf(mouse)).single().kind)
    }

    @Test
    fun `pressure above 1 is capped`() {
        val hard = pen.copy(pressure = 1.3f)

        assertEquals(1f, events(MotionEvent.ACTION_DOWN, pointers = arrayOf(hard)).single().pressure)
    }

    private companion object {
        const val TIME_MS = 1234L
    }
}
