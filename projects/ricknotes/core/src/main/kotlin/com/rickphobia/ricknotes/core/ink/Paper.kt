package com.rickphobia.ricknotes.core.ink

/** What is printed on a page of paper the app makes: an Inserted page now, a Notebook's page later. */
enum class PageBackground { BLANK, LINED, GRID, DOTTED }

/**
 * The one set of measurements for paper the app makes, in PDF points (1/72 inch), so Inserted
 * pages and Notebooks look the same: A4 portrait, lines 8 mm apart, grid and dots 5 mm apart, in
 * light grey, under a plain top margin (spec, Notebooks and inserted pages).
 */
object Paper {
    const val WIDTH_PT = 595
    const val HEIGHT_PT = 842

    private const val POINTS_PER_MM = 72f / 25.4f
    const val LINE_SPACING_PT = 8 * POINTS_PER_MM
    const val GRID_SPACING_PT = 5 * POINTS_PER_MM
    const val TOP_MARGIN_PT = 20 * POINTS_PER_MM

    const val LINE_COLOUR_ARGB = 0xFFD0D0D0.toInt()
    const val LINE_WIDTH_PT = 0.5f
    const val DOT_RADIUS_PT = 0.8f

    /** Where [background]'s lines or dots go on a [widthPt] by [heightPt] page. */
    fun marks(
        background: PageBackground,
        widthPt: Float = WIDTH_PT.toFloat(),
        heightPt: Float = HEIGHT_PT.toFloat(),
    ): PaperMarks =
        when (background) {
            PageBackground.BLANK -> PaperMarks(emptyList(), emptyList(), dots = false)
            PageBackground.LINED -> PaperMarks(rows(LINE_SPACING_PT, heightPt), emptyList(), dots = false)
            PageBackground.GRID -> grid(widthPt, heightPt, dots = false)
            PageBackground.DOTTED -> grid(widthPt, heightPt, dots = true)
        }

    private fun grid(
        widthPt: Float,
        heightPt: Float,
        dots: Boolean,
    ) = PaperMarks(rows(GRID_SPACING_PT, heightPt), steps(GRID_SPACING_PT, widthPt), dots)

    // From the top margin down, stopping short of the bottom edge.
    private fun rows(
        spacing: Float,
        heightPt: Float,
    ): List<Float> = generateSequence(TOP_MARGIN_PT) { it + spacing }.takeWhile { it < heightPt }.toList()

    private fun steps(
        spacing: Float,
        lengthPt: Float,
    ): List<Float> = generateSequence(spacing) { it + spacing }.takeWhile { it < lengthPt }.toList()
}

/**
 * The marks of one page's background, in page points: lines across the page at each of [rows]
 * and, from the top margin down, lines down it at each of [columns]. With [dots], only a dot is
 * drawn where a row and a column cross.
 */
data class PaperMarks(
    val rows: List<Float>,
    val columns: List<Float>,
    val dots: Boolean,
)
