package com.rickphobia.ricknotes.panes

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp

// The line is thin; the strip around it is wide enough to catch a finger or the pen.
private val HANDLE_SIZE = 16.dp

/** What dragging and double-tapping the divider do. [drag] gets each move in pixels. */
internal class DividerActions(
    val drag: (Float) -> Unit,
    val dragEnded: () -> Unit,
    val doubleTap: () -> Unit,
)

/** The divider between two Panes: an upright line when they are [sideBySide], a flat one otherwise. */
@Composable
internal fun PaneDivider(
    sideBySide: Boolean,
    actions: DividerActions,
) {
    val size =
        if (sideBySide) {
            Modifier.fillMaxHeight().width(HANDLE_SIZE)
        } else {
            Modifier.fillMaxWidth().height(HANDLE_SIZE)
        }
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            size
                .pointerInput(sideBySide) {
                    val onDrag = { change: PointerInputChange, amount: Float ->
                        change.consume()
                        actions.drag(amount)
                    }
                    if (sideBySide) {
                        detectHorizontalDragGestures(
                            onDragEnd = actions.dragEnded,
                            onDragCancel = actions.dragEnded,
                            onHorizontalDrag = onDrag,
                        )
                    } else {
                        detectVerticalDragGestures(
                            onDragEnd = actions.dragEnded,
                            onDragCancel = actions.dragEnded,
                            onVerticalDrag = onDrag,
                        )
                    }
                }.pointerInput(Unit) { detectTapGestures(onDoubleTap = { actions.doubleTap() }) },
    ) {
        if (sideBySide) VerticalDivider() else HorizontalDivider()
    }
}
