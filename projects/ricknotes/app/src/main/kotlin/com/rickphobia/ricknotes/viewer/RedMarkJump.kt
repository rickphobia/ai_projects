package com.rickphobia.ricknotes.viewer

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.redink.RedMark

/** A Red mark's outline sits this far outside it, in PDF points, so it doesn't cover the ink. */
internal const val RED_MARK_OUTLINE_MARGIN_PT = 12f

private val BOX_LINE = 3.dp

/** Runs [scrollTo] each time the student picks a Red mark in the Red ink list. */
@Composable
internal fun JumpToRedMark(
    redInk: RedInk,
    scrollTo: suspend (RedMark) -> Unit,
) {
    val mark = redInk.jumpedTo
    LaunchedEffect(mark, redInk.jumps) { mark?.let { scrollTo(it) } }
}

/** Outlines the Red mark the student jumped to from the Red ink list, if it is on page [pageId]. */
@Composable
internal fun RedMarkBox(
    redInk: RedInk,
    pageId: PageId,
    pageWidthPt: Float,
) {
    val mark = redInk.jumpedTo?.takeIf { it.pageId == pageId } ?: return
    // Not red, so it stands out from the red ink it surrounds.
    val colour = MaterialTheme.colorScheme.primary
    Canvas(modifier = Modifier.fillMaxSize()) {
        val pixelsPerPoint = size.width / pageWidthPt
        val box = mark.box.grownBy(RED_MARK_OUTLINE_MARGIN_PT)
        val topLeft = Offset(box.left * pixelsPerPoint, box.top * pixelsPerPoint)
        val boxSize = Size((box.right - box.left) * pixelsPerPoint, (box.bottom - box.top) * pixelsPerPoint)
        drawRect(colour, topLeft, boxSize, style = Stroke(width = BOX_LINE.toPx()))
    }
}
