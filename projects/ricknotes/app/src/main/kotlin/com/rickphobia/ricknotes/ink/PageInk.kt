package com.rickphobia.ricknotes.ink

import android.graphics.Matrix
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.unit.dp
import androidx.core.graphics.withMatrix
import androidx.ink.rendering.android.canvas.CanvasStrokeRenderer
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePoint

// The Lasso's loop and selection box are drawn dashed, so they never look like ink.
private val LASSO_LINE = 2.dp
private const val DASH_PX = 12f
private const val SELECTION_FILL_ALPHA = 0.08f

/**
 * Draws the finished strokes of [ink] on page [pageId] over it, with the Lasso's loop or selection
 * if they are on this page. Strokes are in PDF points, so scaling them by the page's drawn width
 * keeps them on the same spot of the page at any zoom. Ink past the page's edge is cut off, as it
 * will be in an exported PDF.
 */
@Composable
internal fun PageInk(
    ink: DocumentInk,
    pageId: PageId,
    pageWidthPt: Float,
    renderer: CanvasStrokeRenderer,
) {
    val strokes = ink.on(pageId)
    val loop = ink.lasso.loop?.takeIf { it.pageId == pageId }
    if (strokes.isEmpty() && loop == null) return
    val accent = MaterialTheme.colorScheme.primary
    Canvas(modifier = Modifier.fillMaxSize().clipToBounds()) {
        // Read while drawing, not composing, so a drag redraws the page without recomposing it.
        val selection = ink.lasso.selection?.takeIf { it.pageId == pageId }
        val pixelsPerPoint = size.width / pageWidthPt
        val pageToBox = Matrix().apply { setScale(pixelsPerPoint, pixelsPerPoint) }
        // A selection being dragged is drawn where the pen has it, not yet where it is saved.
        val draggedIds = selection?.ids.orEmpty()
        val draggedToBox = Matrix(pageToBox).apply { selection?.drag?.let { preTranslate(it.dx, it.dy) } }
        drawIntoCanvas { canvas ->
            val native = canvas.nativeCanvas
            strokes.forEach {
                val transform = if (it.stroke.id in draggedIds) draggedToBox else pageToBox
                // The renderer uses the transform to pick its detail but leaves applying it to us.
                native.withMatrix(transform) { renderer.draw(native, it.mesh, transform) }
                it.drawn()
            }
        }
        val line =
            Stroke(width = LASSO_LINE.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(DASH_PX, DASH_PX)))
        selection?.box?.let { box ->
            val topLeft = Offset(box.left * pixelsPerPoint, box.top * pixelsPerPoint)
            val boxSize = Size((box.right - box.left) * pixelsPerPoint, (box.bottom - box.top) * pixelsPerPoint)
            drawRect(accent.copy(alpha = SELECTION_FILL_ALPHA), topLeft, boxSize)
            drawRect(accent, topLeft, boxSize, style = line)
        }
        loop?.let { drawLoop(it.points.toList(), pixelsPerPoint, accent, line) }
    }
}

private fun DrawScope.drawLoop(
    points: List<PagePoint>,
    pixelsPerPoint: Float,
    colour: Color,
    line: Stroke,
) {
    val path = Path()
    points.forEachIndexed { i, point ->
        if (i == 0) {
            path.moveTo(point.x * pixelsPerPoint, point.y * pixelsPerPoint)
        } else {
            path.lineTo(point.x * pixelsPerPoint, point.y * pixelsPerPoint)
        }
    }
    drawPath(path, colour, style = line)
}
