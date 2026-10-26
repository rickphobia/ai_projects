package com.rickphobia.ricknotes.viewer

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
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
import androidx.core.graphics.withMatrix
import androidx.ink.rendering.android.canvas.CanvasStrokeRenderer
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.redink.RedMark
import com.rickphobia.ricknotes.core.session.PageRect
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToInt
import androidx.ink.strokes.Stroke as InkStroke

/** A Red mark is shown with this much of its page around it, in PDF points: enough to see the question. */
internal const val RED_MARK_MARGIN_PT = 24f

// A row's picture is drawn this long on its long edge: sharp at the list's size, quick to draw.
private const val PICTURE_LONG_EDGE_PX = 480

// Never sharper than this, so a tiny tick isn't blown up past the page's own detail.
private const val PICTURE_MAX_PIXELS_PER_PT = 4f

private val BOX_LINE = 3.dp

/** [box] grown by [RED_MARK_MARGIN_PT] on every side, cut to a page of [size]. */
internal fun withMargin(
    box: PageRect,
    size: PageSize,
): PageRect =
    PageRect(
        (box.left - RED_MARK_MARGIN_PT).coerceAtLeast(0f),
        (box.top - RED_MARK_MARGIN_PT).coerceAtLeast(0f),
        (box.right + RED_MARK_MARGIN_PT).coerceAtMost(size.widthPt.toFloat()),
        (box.bottom + RED_MARK_MARGIN_PT).coerceAtMost(size.heightPt.toFloat()),
    )

/**
 * Draws a Red mark's [box] on [page] with its margin, page and [strokes], small, for the Red ink
 * list. Drawn when asked and never saved.
 */
internal suspend fun renderRedMarkPicture(
    pages: PdfPages,
    page: DocumentPage,
    box: PageRect,
    strokes: List<InkStroke>,
): Bitmap {
    val size = page.size
    val area = withMargin(box, size)
    val longEdgePt = max(area.right - area.left, area.bottom - area.top).coerceAtLeast(1f)
    val wanted = minOf(PICTURE_MAX_PIXELS_PER_PT, PICTURE_LONG_EDGE_PX / longEdgePt)
    val pageWidthPx = (size.widthPt * wanted).roundToInt().coerceAtLeast(1)
    val scale = pageWidthPx / size.widthPt.toFloat()
    val region =
        PixelRect(
            floor(area.left * scale).toInt(),
            floor(area.top * scale).toInt(),
            ceil(area.right * scale).toInt().coerceAtMost(pageWidthPx),
            ceil(area.bottom * scale).toInt().coerceAtMost(size.heightPx(pageWidthPx)),
        )
    val background = page.background
    val paper =
        if (background != null) {
            withContext(Dispatchers.Default) { renderPaperPart(background, size, pageWidthPx, region) }
        } else {
            pages.renderPart(checkNotNull(page.pdfIndex), size, pageWidthPx, region)
        }
    return withContext(Dispatchers.Default) {
        val picture = if (paper.isMutable) paper else paper.copy(Bitmap.Config.ARGB_8888, true).also { paper.recycle() }
        val canvas = Canvas(picture)
        val renderer = CanvasStrokeRenderer.create()
        val pageToPicture =
            Matrix().apply {
                setScale(scale, scale)
                postTranslate(-region.left.toFloat(), -region.top.toFloat())
            }
        // The renderer uses the transform to pick its detail but leaves applying it to us.
        canvas.withMatrix(pageToPicture) { strokes.forEach { renderer.draw(canvas, it, pageToPicture) } }
        picture
    }
}

/** Runs [scrollTo] each time the student picks a Red mark in the Red ink list. */
@Composable
internal fun JumpToRedMark(
    redInk: RedInk,
    scrollTo: suspend (RedMark) -> Unit,
) {
    val mark = redInk.shown
    LaunchedEffect(mark, redInk.jumps) { mark?.let { scrollTo(it) } }
}

/** Outlines the Red mark the student jumped to from the Red ink list, if it is on page [pageId]. */
@Composable
internal fun RedMarkBox(
    redInk: RedInk,
    pageId: PageId,
    pageWidthPt: Float,
) {
    val mark = redInk.shown?.takeIf { it.pageId == pageId } ?: return
    // Not red, so it stands out from the red ink it surrounds.
    val colour = MaterialTheme.colorScheme.primary
    Canvas(modifier = Modifier.fillMaxSize()) {
        val pixelsPerPoint = size.width / pageWidthPt
        val margin = RED_MARK_MARGIN_PT / 2
        val box = mark.box
        val topLeft = Offset((box.left - margin) * pixelsPerPoint, (box.top - margin) * pixelsPerPoint)
        val boxSize =
            Size(
                (box.right - box.left + margin * 2) * pixelsPerPoint,
                (box.bottom - box.top + margin * 2) * pixelsPerPoint,
            )
        drawRect(colour, topLeft, boxSize, style = Stroke(width = BOX_LINE.toPx()))
    }
}
