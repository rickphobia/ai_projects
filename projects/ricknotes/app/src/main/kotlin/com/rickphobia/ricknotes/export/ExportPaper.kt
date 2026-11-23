package com.rickphobia.ricknotes.export

import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.Paper
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream

/**
 * Draws [background]'s lines or dots on a [widthPt] by [heightPt] page, in the app's page points
 * (the caller's transform maps them to the PDF's). Same marks and colour as `drawPaper` on screen
 * and the Notebooks, all from `Paper.marks`, so an Inserted page in the Export matches the app.
 */
internal fun PDPageContentStream.drawPaper(
    background: PageBackground,
    widthPt: Float,
    heightPt: Float,
) {
    val marks = Paper.marks(background, widthPt, heightPt)
    if (marks.rows.isEmpty()) return
    val argb = Paper.LINE_COLOUR_ARGB
    val red = channel(argb, RED_SHIFT)
    val green = channel(argb, GREEN_SHIFT)
    val blue = channel(argb, BLUE_SHIFT)
    saveGraphicsState()
    if (marks.dots) {
        setNonStrokingColor(red, green, blue)
        marks.rows.forEach { y -> marks.columns.forEach { x -> addCircle(x, y, Paper.DOT_RADIUS_PT) } }
        fill()
    } else {
        setStrokingColor(red, green, blue)
        setLineWidth(Paper.LINE_WIDTH_PT)
        marks.rows.forEach { y ->
            moveTo(0f, y)
            lineTo(widthPt, y)
        }
        marks.columns.forEach { x ->
            moveTo(x, Paper.TOP_MARGIN_PT)
            lineTo(x, heightPt)
        }
        stroke()
    }
    restoreGraphicsState()
}

// A circle as four Bézier quarters: PDF has no circle operator.
private fun PDPageContentStream.addCircle(
    x: Float,
    y: Float,
    radius: Float,
) {
    val k = radius * BEZIER_CIRCLE
    moveTo(x + radius, y)
    curveTo(x + radius, y + k, x + k, y + radius, x, y + radius)
    curveTo(x - k, y + radius, x - radius, y + k, x - radius, y)
    curveTo(x - radius, y - k, x - k, y - radius, x, y - radius)
    curveTo(x + k, y - radius, x + radius, y - k, x + radius, y)
    closePath()
}

private const val BEZIER_CIRCLE = 0.5523f
