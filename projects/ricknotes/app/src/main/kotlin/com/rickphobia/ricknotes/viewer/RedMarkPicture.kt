package com.rickphobia.ricknotes.viewer

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import androidx.core.graphics.withMatrix
import androidx.ink.rendering.android.canvas.CanvasStrokeRenderer
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

/** [box] grown by [RED_MARK_MARGIN_PT] on every side, cut to a page of [size]. */
internal fun withMargin(
    box: PageRect,
    size: PageSize,
): PageRect =
    box.grownBy(RED_MARK_MARGIN_PT).let {
        PageRect(
            it.left.coerceAtLeast(0f),
            it.top.coerceAtLeast(0f),
            it.right.coerceAtMost(size.widthPt.toFloat()),
            it.bottom.coerceAtMost(size.heightPt.toFloat()),
        )
    }

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
