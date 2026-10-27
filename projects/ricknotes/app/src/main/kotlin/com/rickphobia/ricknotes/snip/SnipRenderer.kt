package com.rickphobia.ricknotes.snip

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import androidx.core.graphics.withMatrix
import androidx.ink.rendering.android.canvas.CanvasStrokeRenderer
import com.rickphobia.ricknotes.core.revisionlog.Snips
import com.rickphobia.ricknotes.core.session.PageRect
import com.rickphobia.ricknotes.viewer.DocumentPage
import com.rickphobia.ricknotes.viewer.PdfPages
import com.rickphobia.ricknotes.viewer.renderPaperPart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import androidx.ink.strokes.Stroke as InkStroke

// PNG ignores the quality setting: it is always lossless.
private const val PNG_QUALITY = 100

// Not red, so it stands out from the red ink it surrounds, as the outline on the page does.
private const val OUTLINE_ARGB = 0xFF1565C0.toInt()

// The outline's line, in PDF points, so it looks the same whatever the Snip's size.
private const val OUTLINE_WIDTH_PT = 2f

/**
 * Draws the two Snips of [snip] on [page] off the main thread: the page alone (front) and the page
 * with [strokes] over it, in drawing order, and [outline] (in page points) around them when given
 * (back). A PDF page is drawn from [pages]; an Inserted page's paper is drawn by the app. The PDF
 * and the strokes are only read.
 */
internal suspend fun renderSnips(
    pages: PdfPages,
    page: DocumentPage,
    snip: SnipRegion,
    strokes: List<InkStroke>,
    outline: PageRect? = null,
): Snips {
    val size = page.size
    val background = page.background
    val front =
        if (background != null) {
            withContext(Dispatchers.Default) { renderPaperPart(background, size, snip.pageWidthPx, snip.region) }
        } else {
            pages.renderPart(checkNotNull(page.pdfIndex), size, snip.pageWidthPx, snip.region)
        }
    return withContext(Dispatchers.Default) {
        val back = front.copy(Bitmap.Config.ARGB_8888, true)
        try {
            val pixelsPerPoint = snip.pixelsPerPoint(size)
            drawStrokes(back, snip, pixelsPerPoint, strokes)
            outline?.let { drawOutline(back, snip, pixelsPerPoint, it) }
            Snips(front.toPng(), back.toPng())
        } finally {
            front.recycle()
            back.recycle()
        }
    }
}

private fun drawStrokes(
    target: Bitmap,
    snip: SnipRegion,
    pixelsPerPoint: Float,
    strokes: List<InkStroke>,
) {
    val canvas = Canvas(target)
    val renderer = CanvasStrokeRenderer.create()
    val pageToSnip =
        Matrix().apply {
            setScale(pixelsPerPoint, pixelsPerPoint)
            postTranslate(-snip.region.left.toFloat(), -snip.region.top.toFloat())
        }
    // The renderer uses the transform to pick its detail but leaves applying it to us.
    canvas.withMatrix(pageToSnip) { strokes.forEach { renderer.draw(canvas, it, pageToSnip) } }
}

private fun drawOutline(
    target: Bitmap,
    snip: SnipRegion,
    pixelsPerPoint: Float,
    outline: PageRect,
) {
    val paint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            color = OUTLINE_ARGB
            strokeWidth = OUTLINE_WIDTH_PT * pixelsPerPoint
        }
    Canvas(target).drawRect(
        outline.left * pixelsPerPoint - snip.region.left,
        outline.top * pixelsPerPoint - snip.region.top,
        outline.right * pixelsPerPoint - snip.region.left,
        outline.bottom * pixelsPerPoint - snip.region.top,
        paint,
    )
}

private fun Bitmap.toPng(): ByteArray =
    ByteArrayOutputStream().use { out ->
        check(compress(Bitmap.CompressFormat.PNG, PNG_QUALITY, out)) { "a ${width}x$height Snip didn't encode as PNG" }
        out.toByteArray()
    }
