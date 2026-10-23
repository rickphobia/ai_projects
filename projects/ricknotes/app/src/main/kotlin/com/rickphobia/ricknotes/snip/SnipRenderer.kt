package com.rickphobia.ricknotes.snip

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import androidx.core.graphics.withMatrix
import androidx.ink.rendering.android.canvas.CanvasStrokeRenderer
import com.rickphobia.ricknotes.core.revisionlog.Snips
import com.rickphobia.ricknotes.viewer.PageSize
import com.rickphobia.ricknotes.viewer.PdfPages
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import androidx.ink.strokes.Stroke as InkStroke

// PNG ignores the quality setting: it is always lossless.
private const val PNG_QUALITY = 100

/**
 * Draws the two Snips of [snip] on page [pageIndex] of [pages], off the main thread: the page alone
 * (front) and the page with [strokes] over it, in drawing order (back). The PDF and the strokes are
 * only read.
 */
internal suspend fun renderSnips(
    pages: PdfPages,
    pageIndex: Int,
    size: PageSize,
    snip: SnipRegion,
    strokes: List<InkStroke>,
): Snips {
    val front = pages.renderPart(pageIndex, size, snip.pageWidthPx, snip.region)
    return withContext(Dispatchers.Default) {
        val back = front.copy(Bitmap.Config.ARGB_8888, true)
        try {
            drawStrokes(back, snip, snip.pixelsPerPoint(size), strokes)
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

private fun Bitmap.toPng(): ByteArray =
    ByteArrayOutputStream().use { out ->
        check(compress(Bitmap.CompressFormat.PNG, PNG_QUALITY, out)) { "a ${width}x$height Snip didn't encode as PNG" }
        out.toByteArray()
    }
