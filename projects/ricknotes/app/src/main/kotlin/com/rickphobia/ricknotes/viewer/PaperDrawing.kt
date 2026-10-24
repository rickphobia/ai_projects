package com.rickphobia.ricknotes.viewer

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import androidx.core.graphics.createBitmap
import androidx.core.graphics.withMatrix
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.Paper

/**
 * Draws [background]'s lines or dots, in page points, onto this canvas: the caller's matrix maps
 * points to pixels. Drawn as shapes, not an image, so an Inserted page is sharp at any zoom.
 */
internal fun Canvas.drawPaper(
    background: PageBackground,
    size: PageSize,
) {
    val widthPt = size.widthPt.toFloat()
    val heightPt = size.heightPt.toFloat()
    val marks = Paper.marks(background, widthPt, heightPt)
    val paint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Paper.LINE_COLOUR_ARGB
            strokeWidth = Paper.LINE_WIDTH_PT
        }
    if (marks.dots) {
        marks.rows.forEach { y -> marks.columns.forEach { x -> drawCircle(x, y, Paper.DOT_RADIUS_PT, paint) } }
    } else {
        marks.rows.forEach { y -> drawLine(0f, y, widthPt, y, paint) }
        marks.columns.forEach { x -> drawLine(x, Paper.TOP_MARGIN_PT, x, heightPt, paint) }
    }
}

/**
 * Draws only [region] of an Inserted page with [background] as it looks with the page
 * [pageWidthPx] wide, on white paper: the same image `PdfPages.renderPart` gives for a PDF page.
 */
internal fun renderPaperPart(
    background: PageBackground,
    size: PageSize,
    pageWidthPx: Int,
    region: PixelRect,
): Bitmap {
    val scale = pageWidthPx / size.widthPt.toFloat()
    val pageToPart =
        Matrix().apply {
            setScale(scale, scale)
            postTranslate(-region.left.toFloat(), -region.top.toFloat())
        }
    return createBitmap(region.width, region.height).also { bitmap ->
        bitmap.eraseColor(Color.WHITE)
        Canvas(bitmap).run { withMatrix(pageToPart) { drawPaper(background, size) } }
    }
}
