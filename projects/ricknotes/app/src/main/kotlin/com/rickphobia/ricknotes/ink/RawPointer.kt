package com.rickphobia.ricknotes.ink

import android.view.MotionEvent
import com.rickphobia.ricknotes.core.touch.PointerKind
import com.rickphobia.ricknotes.core.touch.TouchEvent
import com.rickphobia.ricknotes.core.touch.TouchPhase

/** One pointer of a [MotionEvent], read out as plain values. */
internal data class RawPointer(
    val id: Int,
    val toolType: Int,
    val x: Float,
    val y: Float,
    val pressure: Float,
    val touchMajor: Float,
)

/**
 * The plain events `core`'s touch interpreter reads, one per pointer this [MotionEvent] changed.
 * Takes touch events and the pen's hover events.
 */
internal fun MotionEvent.toTouchEvents(): List<TouchEvent> =
    touchEventsOf(
        actionMasked = actionMasked,
        actionIndex = actionIndex,
        cancelled = flags and MotionEvent.FLAG_CANCELED != 0,
        timeMs = eventTime,
        pointers = List(pointerCount, ::rawPointer),
    )

private fun MotionEvent.rawPointer(index: Int) =
    RawPointer(
        getPointerId(index),
        getToolType(index),
        getX(index),
        getY(index),
        getPressure(index),
        getTouchMajor(index),
    )

/**
 * A down or up changes only the pointer at [actionIndex]; a move or hover reports every pointer. A
 * pointer going up with [cancelled] set is one Android decided was unintended, such as a palm (this
 * is how a palm the screen reports reaches apps), so it is cancelled rather than finished.
 */
internal fun touchEventsOf(
    actionMasked: Int,
    actionIndex: Int,
    cancelled: Boolean,
    timeMs: Long,
    pointers: List<RawPointer>,
): List<TouchEvent> {
    fun event(
        pointer: RawPointer,
        phase: TouchPhase,
    ) = TouchEvent(
        pointer.id,
        kindOf(pointer.toolType),
        phase,
        pointer.x,
        pointer.y,
        pointer.pressure.coerceIn(0f, 1f),
        pointer.touchMajor.coerceAtLeast(0f),
        timeMs,
    )

    return when (actionMasked) {
        MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
            listOf(event(pointers[actionIndex], TouchPhase.DOWN))
        }

        MotionEvent.ACTION_MOVE -> {
            pointers.map { event(it, TouchPhase.MOVE) }
        }

        MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
            listOf(event(pointers[actionIndex], if (cancelled) TouchPhase.CANCEL else TouchPhase.UP))
        }

        MotionEvent.ACTION_CANCEL -> {
            pointers.map { event(it, TouchPhase.CANCEL) }
        }

        MotionEvent.ACTION_HOVER_ENTER, MotionEvent.ACTION_HOVER_MOVE -> {
            pointers.map { event(it, TouchPhase.HOVER) }
        }

        MotionEvent.ACTION_HOVER_EXIT -> {
            pointers.map { event(it, TouchPhase.HOVER_EXIT) }
        }

        else -> {
            emptyList()
        }
    }
}

// Only the stylus is a pen. A mouse or an unknown tool counts as a finger, so it never draws.
private fun kindOf(toolType: Int): PointerKind =
    if (toolType == MotionEvent.TOOL_TYPE_STYLUS) PointerKind.PEN else PointerKind.FINGER
