package com.rickphobia.ricknotes.toolbar

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.ink.FavouritePens
import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.afterTappingPen
import com.rickphobia.ricknotes.logging.AppLog

private val SWATCH = 32.dp

private val BLOCK = RoundedCornerShape(4.dp)

// A pink eraser block, so it doesn't look like ink.
private const val ERASER_ARGB = 0xFFF8BBD0.toInt()

private val LASSO_LINE = 2.dp
private val LASSO_DASH = 5.dp

/** What the pen is picked to be: the ink tool in use, the eraser or the Lasso. */
enum class PenKind { INK, ERASER, LASSO }

/**
 * The Document's pens, highlighter, eraser and Lasso, picking [tool] and [kind]. The tool in use
 * has a thick ring round it; tapping the pen in use moves on through [favouritePens].
 */
@Composable
fun PenToolbar(
    tool: MutableState<InkTool>,
    kind: MutableState<PenKind>,
    favouritePens: FavouritePens,
) {
    val current = tool.value.takeIf { kind.value == PenKind.INK }
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PenColour.entries.forEach { colour ->
            ToolSwatch(
                shape = CircleShape,
                label = penName(colour),
                selected = current == InkTool.Pen(colour),
                onClick = {
                    tool.value = current?.afterTappingPen(colour, favouritePens) ?: InkTool.Pen(colour)
                    kind.value = PenKind.INK
                    AppLog.d("tool: ${tool.value}")
                },
            ) { ColourFill(Color(colour.argb), CircleShape) }
        }
        ToolSwatch(
            shape = BLOCK,
            label = stringResource(R.string.highlighter),
            selected = current == InkTool.Highlighter,
            onClick = {
                tool.value = InkTool.Highlighter
                kind.value = PenKind.INK
                AppLog.d("tool: highlighter")
            },
        ) { ColourFill(Color(InkTool.Highlighter.colourArgb), BLOCK) }
        ToolSwatch(
            shape = BLOCK,
            label = stringResource(R.string.eraser),
            selected = kind.value == PenKind.ERASER,
            onClick = {
                kind.value = PenKind.ERASER
                AppLog.d("tool: eraser")
            },
        ) { ColourFill(Color(ERASER_ARGB), BLOCK) }
        ToolSwatch(
            shape = BLOCK,
            label = stringResource(R.string.lasso),
            selected = kind.value == PenKind.LASSO,
            onClick = {
                kind.value = PenKind.LASSO
                AppLog.d("tool: lasso")
            },
        ) { LassoIcon() }
    }
}

/** A dashed loop, as the Lasso draws one. */
@Composable
private fun LassoIcon() {
    val colour = MaterialTheme.colorScheme.onSurface
    Canvas(modifier = Modifier.size(SWATCH)) {
        val line = LASSO_LINE.toPx()
        val dash = PathEffect.dashPathEffect(floatArrayOf(LASSO_DASH.toPx(), LASSO_DASH.toPx()))
        drawCircle(colour, radius = (size.minDimension - line) / 2, style = Stroke(line, pathEffect = dash))
    }
}

@Composable
private fun ColourFill(
    colour: Color,
    shape: Shape,
) {
    Box(modifier = Modifier.size(SWATCH).background(colour, shape))
}

/** Undo and redo buttons, each disabled when there is nothing for it to do. */
@Composable
fun UndoRedoButtons(
    canUndo: Boolean,
    canRedo: Boolean,
    onUndo: () -> Unit,
    onRedo: () -> Unit,
) {
    Row {
        TextButton(onClick = onUndo, enabled = canUndo) { Text(stringResource(R.string.undo)) }
        TextButton(onClick = onRedo, enabled = canRedo) { Text(stringResource(R.string.redo)) }
    }
}

/** A round swatch of a pen's colour, as the toolbar and the Favourite pens editor show it. */
@Composable
fun PenSwatch(
    colour: PenColour,
    size: Dp = SWATCH,
) {
    Box(modifier = Modifier.size(size).background(Color(colour.argb), CircleShape))
}

@Composable
fun penName(colour: PenColour): String =
    stringResource(
        when (colour) {
            PenColour.BLACK -> R.string.pen_black
            PenColour.BLUE -> R.string.pen_blue
            PenColour.RED -> R.string.pen_red
            PenColour.GREEN -> R.string.pen_green
        },
    )

@Composable
private fun ToolSwatch(
    shape: Shape,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    inside: @Composable () -> Unit,
) {
    val ring = if (selected) 4.dp else 1.dp
    val ringColour = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
    Box(
        modifier =
            Modifier
                .size(SWATCH + 12.dp)
                .border(ring, ringColour, shape)
                .clickable(onClick = onClick)
                .semantics {
                    contentDescription = label
                    this.selected = selected
                },
        contentAlignment = Alignment.Center,
    ) {
        inside()
    }
}
