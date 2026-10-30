package com.rickphobia.ricknotes.core.logpdf

import com.rickphobia.ricknotes.core.ink.Paper
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.session.PageRect
import kotlin.math.ceil
import kotlin.math.floor

/** A Snip's size in pixels, as read from its PNG. */
data class SnipSize(
    val widthPx: Int,
    val heightPx: Int,
)

/** An Entry to put in a Log PDF with its back Snip's size, or null when that Snip can't be read. */
data class ExportedEntry(
    val entry: Entry,
    val snip: SnipSize?,
)

/** A rectangle on a Log PDF page, in PDF points from the page's top-left corner. */
data class PdfRect(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
) {
    val width: Float get() = right - left
    val height: Float get() = bottom - top
}

/** The part of a Snip that is drawn, in its pixels. */
data class SnipCrop(
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
)

/**
 * One Entry on a Log PDF page: its label lines go in [text], and the [crop] of its back Snip is
 * drawn into [snip]. Both are null when the Snip can't be read.
 */
data class PlacedEntry(
    val entry: Entry,
    val text: PdfRect,
    val crop: SnipCrop?,
    val snip: PdfRect?,
)

/** One A4 page of a Log PDF: its Entries top to bottom. */
data class LogPdfPage(
    val entries: List<PlacedEntry>,
)

/** There are no Entries to export, so no PDF is written. */
class NothingToExport : Exception("there are no Entries to export")

/**
 * Decides which Entries go on which page of a Revision log's PDF, and where. Each Entry is a block
 * of label lines with its back Snip under it; an Entry never splits across two pages.
 */
object LogPdfLayout {
    const val PAGE_WIDTH_PT = Paper.WIDTH_PT.toFloat()
    const val PAGE_HEIGHT_PT = Paper.HEIGHT_PT.toFloat()

    /** Round all four sides: about 14 mm, inside what any printer can print. */
    const val MARGIN_PT = 40f
    const val PRINTABLE_WIDTH_PT = PAGE_WIDTH_PT - 2 * MARGIN_PT
    const val PRINTABLE_HEIGHT_PT = PAGE_HEIGHT_PT - 2 * MARGIN_PT

    /** A tall Snip is capped here, so a page always holds it whole with room for others. */
    const val MAX_SNIP_HEIGHT_PT = PRINTABLE_HEIGHT_PT / 2

    /** The label lines above each Snip: kind and category, source, and up to two lines of "why". */
    const val LABEL_LINES = 4
    const val LABEL_LINE_HEIGHT_PT = 14f
    const val TEXT_BLOCK_HEIGHT_PT = LABEL_LINES * LABEL_LINE_HEIGHT_PT

    /** The space between one Entry and the next. */
    const val ENTRY_GAP_PT = 18f

    /**
     * The pages for [entries], kept in the order given (the screen's filter and order). An Entry
     * with a box is cropped to it grown by [boxMarginPt], the margin its Snip opens with on screen.
     *
     * @throws NothingToExport if [entries] is empty.
     */
    fun pages(
        entries: List<ExportedEntry>,
        boxMarginPt: Float,
    ): List<LogPdfPage> {
        if (entries.isEmpty()) throw NothingToExport()
        val pages = mutableListOf<LogPdfPage>()
        var page = mutableListOf<PlacedEntry>()
        var top = MARGIN_PT
        for (exported in entries) {
            val crop =
                exported.snip
                    ?.takeIf { it.widthPx > 0 && it.heightPx > 0 }
                    ?.let { cropOf(exported.entry, it, boxMarginPt) }
            val snipSize = crop?.let(::drawnSize)
            val height = TEXT_BLOCK_HEIGHT_PT + (snipSize?.second ?: 0f)
            if (page.isNotEmpty() && top + height > PAGE_HEIGHT_PT - MARGIN_PT) {
                pages.add(LogPdfPage(page))
                page = mutableListOf()
                top = MARGIN_PT
            }
            val text = PdfRect(MARGIN_PT, top, MARGIN_PT + PRINTABLE_WIDTH_PT, top + TEXT_BLOCK_HEIGHT_PT)
            val snip =
                snipSize?.let { (width, snipHeight) ->
                    PdfRect(MARGIN_PT, text.bottom, MARGIN_PT + width, text.bottom + snipHeight)
                }
            page.add(PlacedEntry(exported.entry, text, crop, snip))
            top += height + ENTRY_GAP_PT
        }
        pages.add(LogPdfPage(page))
        return pages
    }

    // The width and height a crop is drawn at: as wide as the page allows, keeping its shape.
    private fun drawnSize(crop: SnipCrop): Pair<Float, Float> {
        val width = (crop.right - crop.left).toFloat()
        val height = (crop.bottom - crop.top).toFloat()
        val scale = minOf(PRINTABLE_WIDTH_PT / width, MAX_SNIP_HEIGHT_PT / height)
        return width * scale to height * scale
    }

    // The whole Snip, or for an Entry with a box the box grown by the margin and cut to the Snip.
    private fun cropOf(
        entry: Entry,
        snip: SnipSize,
        boxMarginPt: Float,
    ): SnipCrop {
        val whole = SnipCrop(0, 0, snip.widthPx, snip.heightPx)
        val box = entry.box ?: return whole
        val area = entry.source.area
        val xScale = snip.widthPx / (area.right - area.left)
        val yScale = snip.heightPx / (area.bottom - area.top)
        val grown: PageRect = box.grownBy(boxMarginPt)
        val crop =
            SnipCrop(
                floor((grown.left - area.left) * xScale).toInt().coerceIn(0, snip.widthPx),
                floor((grown.top - area.top) * yScale).toInt().coerceIn(0, snip.heightPx),
                ceil((grown.right - area.left) * xScale).toInt().coerceIn(0, snip.widthPx),
                ceil((grown.bottom - area.top) * yScale).toInt().coerceIn(0, snip.heightPx),
            )
        // A box that misses the area (it shouldn't) shows the whole Snip rather than nothing.
        return if (crop.right > crop.left && crop.bottom > crop.top) crop else whole
    }
}
