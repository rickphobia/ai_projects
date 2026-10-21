package com.rickphobia.ricknotes.ink

import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.core.ink.ScreenPoint
import com.rickphobia.ricknotes.core.ink.pageAt
import com.rickphobia.ricknotes.core.touch.TouchAction
import com.rickphobia.ricknotes.logging.AppLog

/**
 * Carries out what fingers mean on an open Document: moving the pages through [navigation],
 * erasing with [eraser] when Finger erase is on, and undo and redo from taps.
 */
internal class FingerTouch(
    private val ink: DocumentInk,
    private val placements: () -> List<PagePlacement>,
    private val navigation: TouchNavigation,
    private val eraser: StrokeEraser,
) {
    fun carryOut(action: TouchAction) {
        when (action) {
            TouchAction.ScrollStart -> navigation.stop()
            is TouchAction.Scroll -> navigation.scroll(action)
            is TouchAction.Pinch -> navigation.pinch(action)
            TouchAction.ScrollEnd -> navigation.scrollEnd()
            TouchAction.Undo -> if (ink.canUndo) ink.undo() else AppLog.d("two-finger tap with nothing to undo")
            TouchAction.Redo -> if (ink.canRedo) ink.redo() else AppLog.d("three-finger tap with nothing to redo")
            is TouchAction.Reject -> reject(action)
            else -> erase(action)
        }
    }

    private fun erase(action: TouchAction) {
        when (action) {
            is TouchAction.StartErase -> {
                startErase(action)
            }

            is TouchAction.ExtendErase -> {
                eraser.extend(action.pointerId, ScreenPoint(action.x, action.y))
            }

            is TouchAction.EndErase -> {
                eraser.end(action.pointerId)
            }

            is TouchAction.CancelErase -> {
                eraser.cancel(action.pointerId)
            }

            else -> {}
        }
    }

    private fun startErase(action: TouchAction.StartErase) {
        navigation.stop()
        if (ink.readOnly) {
            AppLog.d("finger erase on a read-only Document; nothing erased")
            return
        }
        val at = ScreenPoint(action.x, action.y)
        pageAt(placements(), at)?.let { eraser.start(action.pointerId, it, at) }
    }

    private fun reject(action: TouchAction.Reject) {
        // Whatever this finger was erasing stays.
        eraser.cancel(action.pointerId)
        AppLog.d("touch ${action.pointerId} ignored: ${action.reason}")
    }
}
