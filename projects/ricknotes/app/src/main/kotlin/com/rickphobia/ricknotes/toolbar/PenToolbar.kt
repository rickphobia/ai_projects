package com.rickphobia.ricknotes.toolbar

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.ink.FavouritePens
import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.afterTappingPen
import com.rickphobia.ricknotes.logging.AppLog

private val SWATCH = 32.dp

/** What the pen is picked to be: the ink tool in use, the eraser or the Lasso. */
enum class PenKind { INK, ERASER, LASSO }

/**
 * The Document's pens, highlighter, eraser and Lasso, picking [tool] and [kind]. The tool in use
 * sits on a filled circle; tapping the pen in use moves on through [favouritePens].
 */
@Composable
fun PenToolbar(
    tool: MutableState<InkTool>,
    kind: MutableState<PenKind>,
    favouritePens: FavouritePens,
) {
    val current = tool.value.takeIf { kind.value == PenKind.INK }
    Row(verticalAlignment = Alignment.CenterVertically) {
        PenColour.entries.forEach { colour ->
            ToolIcon(
                icon = R.drawable.ic_edit,
                label = penName(colour),
                selected = current == InkTool.Pen(colour),
                inkMark = Color(colour.argb),
                onClick = {
                    tool.value = current?.afterTappingPen(colour, favouritePens) ?: InkTool.Pen(colour)
                    kind.value = PenKind.INK
                    AppLog.d("tool: ${tool.value}")
                },
            )
        }
        ToolIcon(
            icon = R.drawable.ic_ink_highlighter,
            label = stringResource(R.string.highlighter),
            selected = current == InkTool.Highlighter,
            inkMark = Color(InkTool.Highlighter.colourArgb),
            onClick = {
                tool.value = InkTool.Highlighter
                kind.value = PenKind.INK
                AppLog.d("tool: highlighter")
            },
        )
        ToolIcon(
            icon = R.drawable.ic_ink_eraser,
            label = stringResource(R.string.eraser),
            selected = kind.value == PenKind.ERASER,
            onClick = {
                kind.value = PenKind.ERASER
                AppLog.d("tool: eraser")
            },
        )
        ToolIcon(
            icon = R.drawable.ic_lasso_select,
            label = stringResource(R.string.lasso),
            selected = kind.value == PenKind.LASSO,
            onClick = {
                kind.value = PenKind.LASSO
                AppLog.d("tool: lasso")
            },
        )
    }
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
        ToolIcon(R.drawable.ic_undo, stringResource(R.string.undo), onUndo.takeIf { canUndo })
        ToolIcon(R.drawable.ic_redo, stringResource(R.string.redo), onRedo.takeIf { canRedo })
    }
}

@Composable
fun BackButton(onBack: () -> Unit) {
    ToolIcon(R.drawable.ic_arrow_back, stringResource(R.string.back), onBack)
}

/** A round swatch of a pen's colour, as the Favourite pens editor shows it. */
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
