package com.rickphobia.ricknotes.export

import androidx.ink.geometry.MutableVec
import androidx.ink.geometry.PartitionedMesh
import com.rickphobia.ricknotes.core.export.ExportPage
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.ink.toMesh
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState
import com.tom_roush.pdfbox.util.Matrix

/**
 * Draws one page of an Export into [document] (decision 0008). A PDF page, taken from [pdfPages]
 * (the PDF's own pages, listed before any page was added, since an Inserted page shifts the
 * document's page numbers), keeps its own content as it is, with the strokes appended over it; an
 * Inserted page is added new, right after [previous] (or first, when there is none), with its
 * background's lines or dots. Returns the page, so the next Inserted page can follow it.
 *
 * Pictures go first, then the strokes over them, as on screen.
 *
 * Each stroke is the outline of the mesh Jetpack Ink builds with the on-screen brush, filled as a
 * vector shape in its colour, so the Export looks like the screen at any zoom. A stroke Ink can't
 * build is left out, as it is on screen (`toMesh` logs it).
 */
internal fun drawExportPage(
    document: PDDocument,
    pdfPages: List<PDPage>,
    page: ExportPage,
    previous: PDPage?,
    shared: SharedResources,
): PDPage {
    val target =
        when (page) {
            is ExportPage.FromPdf -> pdfPages[page.index]
            is ExportPage.Inserted -> newPage(document, PDRectangle(page.widthPt, page.heightPt), previous)
        }
    if (page is ExportPage.FromPdf && page.strokes.isEmpty() && page.pictures.isEmpty()) return target
    // Append, compressed, wrapping the page's own content in q…Q so a graphics state it leaves set
    // can't change how the strokes come out.
    PDPageContentStream(document, target, PDPageContentStream.AppendMode.APPEND, true, true).use { out ->
        out.saveGraphicsState()
        out.transform(appTopLeftToPdf(target))
        if (page is ExportPage.Inserted) out.drawPaper(page.background, page.widthPt, page.heightPt)
        page.pictures.forEach { out.drawPicture(it, shared.images) }
        val vertex = MutableVec()
        page.strokes.forEach { stroke ->
            val mesh = stroke.toMesh() ?: return@forEach
            out.fillStroke(stroke, mesh.shape, vertex, shared.alphaStates)
        }
        out.restoreGraphicsState()
    }
    return target
}

private fun newPage(
    document: PDDocument,
    size: PDRectangle,
    previous: PDPage?,
): PDPage {
    val page = PDPage(size)
    when {
        previous != null -> document.pages.insertAfter(page, previous)
        document.numberOfPages > 0 -> document.pages.insertBefore(page, document.getPage(0))
        else -> document.addPage(page)
    }
    return page
}

private fun PDPageContentStream.fillStroke(
    stroke: Stroke,
    shape: PartitionedMesh,
    vertex: MutableVec,
    alphaStates: AlphaStates,
) {
    val argb = stroke.colourArgb
    saveGraphicsState()
    // The highlighter's colour is see-through; PDF colours aren't, so its alpha goes in a graphics state.
    alphaStates.forAlpha(argb ushr ALPHA_SHIFT)?.let(::setGraphicsStateParameters)
    setNonStrokingColor(channel(argb, RED_SHIFT), channel(argb, GREEN_SHIFT), channel(argb, BLUE_SHIFT))
    for (group in 0 until shape.getRenderGroupCount()) {
        for (outline in 0 until shape.getOutlineCount(group)) addOutline(shape, group, outline, vertex)
    }
    // One fill per stroke with the non-zero rule: where its outlines overlap it is filled once, so a
    // highlighter stroke crossing itself doesn't darken, as on screen.
    fill()
    restoreGraphicsState()
}

// Adds one closed outline of [shape] to the path being built, in page points.
private fun PDPageContentStream.addOutline(
    shape: PartitionedMesh,
    group: Int,
    outline: Int,
    vertex: MutableVec,
) {
    val vertices = shape.getOutlineVertexCount(group, outline)
    if (vertices == 0) return
    for (index in 0 until vertices) {
        shape.populateOutlinePosition(group, outline, index, vertex)
        if (index == 0) moveTo(vertex.x, vertex.y) else lineTo(vertex.x, vertex.y)
    }
    closePath()
}

/**
 * The transform from the app's page points (from the top-left corner of the page as shown, which is
 * the crop box turned by the page's rotation) to the PDF page's own coordinates (from the bottom
 * left of its media, y up).
 */
private fun appTopLeftToPdf(page: PDPage): Matrix {
    val box = page.cropBox
    val left = box.lowerLeftX
    val bottom = box.lowerLeftY
    val right = box.upperRightX
    val top = box.upperRightY
    return when (Math.floorMod(page.rotation, FULL_TURN)) {
        QUARTER_TURN -> Matrix(0f, 1f, 1f, 0f, left, bottom)
        HALF_TURN -> Matrix(-1f, 0f, 0f, 1f, right, bottom)
        THREE_QUARTER_TURN -> Matrix(0f, -1f, -1f, 0f, right, top)
        else -> Matrix(1f, 0f, 0f, -1f, left, top)
    }
}

/** What every page of an Export draws with, made once for the whole Export. */
internal class SharedResources(
    val alphaStates: AlphaStates,
    val images: PictureImages,
)

/** One graphics state per see-through alpha, shared by every page of an Export. */
internal class AlphaStates {
    private val states = mutableMapOf<Int, PDExtendedGraphicsState>()

    /** The state for [alpha] (0–255), or null when it is opaque and needs none. */
    fun forAlpha(alpha: Int): PDExtendedGraphicsState? =
        if (alpha >= OPAQUE) {
            null
        } else {
            states.getOrPut(alpha) {
                PDExtendedGraphicsState().apply { nonStrokingAlphaConstant = alpha / CHANNEL_MAX }
            }
        }
}

internal fun channel(
    argb: Int,
    shift: Int,
): Float = ((argb shr shift) and OPAQUE) / CHANNEL_MAX

private const val ALPHA_SHIFT = 24
internal const val RED_SHIFT = 16
internal const val GREEN_SHIFT = 8
internal const val BLUE_SHIFT = 0
private const val OPAQUE = 0xFF
private const val CHANNEL_MAX = 255f
private const val FULL_TURN = 360
private const val QUARTER_TURN = 90
private const val HALF_TURN = 180
private const val THREE_QUARTER_TURN = 270
