package com.rickphobia.ricknotes.core.touch

import java.util.Locale

/**
 * Tells a resting hand from a finger. A finger is rejected for as long as it stays down if it lands
 * while the pen is touching or hovering, or within [TouchThresholds.penLockoutMs] after, or if its
 * contact is ever wider than [TouchThresholds.maxFingertipMm].
 */
internal class HandRejection(
    private val thresholds: TouchThresholds,
    private val pixelsPerMm: Float,
) {
    private var penTouching = false
    private var penHovering = false
    private var penLastSeenMs: Long? = null
    private val rejected = mutableSetOf<Int>()

    fun penSeen(event: TouchEvent) {
        penLastSeenMs = event.timeMs
        when (event.phase) {
            // Some screens touch down without a hover exit first; touching ends hovering either way.
            TouchPhase.DOWN -> {
                penTouching = true
                penHovering = false
            }

            TouchPhase.UP, TouchPhase.CANCEL -> {
                penTouching = false
            }

            TouchPhase.HOVER -> {
                penHovering = true
            }

            TouchPhase.HOVER_EXIT -> {
                penHovering = false
            }

            TouchPhase.MOVE -> {}
        }
    }

    /** The pen is touching, hovering, or was one of those less than the lockout time ago. */
    fun penNear(timeMs: Long): Boolean {
        val lastSeen = penLastSeenMs ?: return false
        return penTouching || penHovering || timeMs - lastSeen < thresholds.penLockoutMs
    }

    /** Whether this finger was rejected earlier. Its lifting ends that. */
    fun alreadyRejected(event: TouchEvent): Boolean {
        val wasRejected = event.pointerId in rejected
        if (event.phase == TouchPhase.UP || event.phase == TouchPhase.CANCEL) rejected.remove(event.pointerId)
        return wasRejected
    }

    /** Why this finger is a resting hand from now on, or null if it isn't. */
    fun rejectionReason(event: TouchEvent): String? {
        val contactMm = event.contactPx / pixelsPerMm
        val stillDown = event.phase == TouchPhase.DOWN || event.phase == TouchPhase.MOVE
        val reason =
            when {
                event.phase == TouchPhase.DOWN && penNear(event.timeMs) -> {
                    "the pen is near or just lifted"
                }

                stillDown && contactMm > thresholds.maxFingertipMm -> {
                    String.format(
                        Locale.ROOT,
                        "contact %.1f mm is wider than a fingertip (%.1f mm)",
                        contactMm,
                        thresholds.maxFingertipMm,
                    )
                }

                else -> {
                    null
                }
            }
        if (reason != null) rejected.add(event.pointerId)
        return reason
    }
}
