package com.rickphobia.ricknotes.ink

import android.annotation.SuppressLint
import android.content.Context
import android.view.MotionEvent
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.FrameLayout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.ink.authoring.InProgressStrokesView
import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.core.touch.FingerGestures
import com.rickphobia.ricknotes.core.touch.TouchAction
import com.rickphobia.ricknotes.core.touch.TouchInterpreter
import com.rickphobia.ricknotes.core.touch.TouchThresholds

/**
 * The layer over an open Document's pages that takes every touch on them: the pen draws in it with
 * Jetpack Ink's low-latency renderer, and fingers move the pages under it through [navigation].
 * It is an Android View, not Compose, because low-latency ink needs the raw [MotionEvent]s.
 */
@Composable
internal fun InkLayer(
    ink: DocumentInk,
    placements: () -> List<PagePlacement>,
    navigation: TouchNavigation,
    penMode: () -> PenMode,
    gestures: FingerGestures,
) {
    val currentPlacements = rememberUpdatedState(placements)
    val currentNavigation = rememberUpdatedState(navigation)
    val mode = rememberUpdatedState(penMode)
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            TouchLayerView(context).also { layer ->
                // The Document screen is made again on the way back from Settings, so the
                // gestures it was made with are always the current ones.
                val interpreter = TouchInterpreter(gestures, TouchThresholds(), pixelsPerMm(context))
                val touch =
                    DocumentTouch(
                        inProgress = layer.inProgress,
                        ink = ink,
                        placements = { currentPlacements.value() },
                        navigation = DelegatingNavigation { currentNavigation.value },
                        clockMs = System::currentTimeMillis,
                        penMode = { mode.value() },
                    )
                layer.inProgress.addFinishedStrokesListener(touch)
                layer.onTouch = { view, event ->
                    for (pointer in event.toTouchEvents()) touch.carryOut(view, event, interpreter.handle(pointer))
                }
            }
        },
    )
}

private const val MM_PER_INCH = 25.4f

// The screen's real density, not Android's rounded density bucket, so millimetres are millimetres.
private fun pixelsPerMm(context: Context): Float = context.resources.displayMetrics.xdpi / MM_PER_INCH

// Lets the View, made once, follow a navigation that Compose may replace on recomposition.
private class DelegatingNavigation(
    private val current: () -> TouchNavigation,
) : TouchNavigation {
    override fun stop() = current().stop()

    override fun scroll(action: TouchAction.Scroll) = current().scroll(action)

    override fun pinch(action: TouchAction.Pinch) = current().pinch(action)

    override fun scrollEnd() = current().scrollEnd()
}

// Touches on the pages are writing and moving, never clicks, so there is no click to perform.
@SuppressLint("ViewConstructor", "ClickableViewAccessibility")
private class TouchLayerView(
    context: Context,
) : FrameLayout(context) {
    val inProgress = InProgressStrokesView(context)
    var onTouch: (TouchLayerView, MotionEvent) -> Unit = { _, _ -> }

    init {
        addView(inProgress, LayoutParams(MATCH_PARENT, MATCH_PARENT))
        // Sets up the low-latency renderer now rather than on the first stroke, so it isn't late.
        inProgress.eagerInit()
    }

    // Every touch is ours, even if a child of the Ink view would take it.
    override fun onInterceptTouchEvent(event: MotionEvent): Boolean = true

    override fun onTouchEvent(event: MotionEvent): Boolean {
        onTouch(this, event)
        return true
    }

    // The pen hovering keeps fingers from counting, so its hover events are ours too.
    override fun dispatchHoverEvent(event: MotionEvent): Boolean {
        onTouch(this, event)
        return true
    }
}
