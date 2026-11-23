package com.rickphobia.ricknotes.core.export

import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.Paper
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.inkfile.InkPage
import com.rickphobia.ricknotes.core.session.DocumentSnapshot

/**
 * One page of an Export, with the Pictures to draw on it first, in their drawing order, then the
 * strokes over them in the order they were written. Both are in PDF points from the page's top-left
 * corner as the app shows it.
 */
sealed interface ExportPage {
    val strokes: List<Stroke>
    val pictures: List<Picture>

    /** The PDF's own page [index] (from 0), kept as it is. */
    data class FromPdf(
        val index: Int,
        override val strokes: List<Stroke>,
        override val pictures: List<Picture>,
    ) : ExportPage

    /** An Inserted page: A4 portrait paper with [background], made new in the Export. */
    data class Inserted(
        val background: PageBackground,
        override val strokes: List<Stroke>,
        override val pictures: List<Picture>,
    ) : ExportPage {
        val widthPt: Float get() = Paper.WIDTH_PT.toFloat()
        val heightPt: Float get() = Paper.HEIGHT_PT.toFloat()
    }
}

/**
 * What an Export of one Document sends (spec, export with ink, "Seams"). The app draws [WithInk]
 * into a new PDF, shares the PDF itself for [Bare], and refuses with a message for the other two.
 */
sealed interface ExportPlan {
    /** Ink isn't wanted, or there is none: the PDF goes as it is. */
    data object Bare : ExportPlan

    /** Every page of the Document in order, each with its Pictures and strokes. */
    data class WithInk(
        val pages: List<ExportPage>,
    ) : ExportPlan {
        val strokeCount: Int get() = pages.sumOf { it.strokes.size }
        val insertedCount: Int get() = pages.count { it is ExportPage.Inserted }
        val pictureCount: Int get() = pages.sumOf { it.pictures.size }
    }

    /** The Ink file can't be read, so what the ink is isn't known. */
    data object InkUnreadable : ExportPlan

    /** A Conflict copy waits on Keep mine or Keep the other, so which ink would go isn't settled. */
    data object PickASideFirst : ExportPlan

    companion object {
        /** Decides what an Export of [snapshot] sends; [inkWanted] is false for a Preset marked ink off. */
        fun of(
            snapshot: DocumentSnapshot,
            inkWanted: Boolean,
        ): ExportPlan =
            when {
                !inkWanted -> {
                    Bare
                }

                snapshot.inkUnreadable -> {
                    InkUnreadable
                }

                snapshot.conflictWaiting -> {
                    PickASideFirst
                }

                snapshot.strokes.isEmpty() && snapshot.pictures.isEmpty() && snapshot.pages.none { it.inserted } -> {
                    Bare
                }

                else -> {
                    WithInk(pages(snapshot))
                }
            }

        private fun pages(snapshot: DocumentSnapshot): List<ExportPage> {
            val strokesByPage = snapshot.strokes.groupBy { it.pageId }
            val picturesByPage = snapshot.pictures.groupBy { it.pageId }
            return snapshot.pages.mapNotNull { page ->
                val strokes = strokesByPage[page.id].orEmpty()
                val pictures = picturesByPage[page.id].orEmpty()
                val background = page.background
                if (background != null) {
                    ExportPage.Inserted(background, strokes, pictures)
                } else {
                    // A page the PDF no longer has can't be drawn on; its ink stays in the Ink file.
                    pdfIndex(page)
                        ?.takeIf { it < snapshot.pdfPageCount }
                        ?.let { ExportPage.FromPdf(it, strokes, pictures) }
                }
            }
        }

        // The PDF's own pages are `pdf-<number>`, numbered from 1 (see PageId.ofPdfPage).
        private fun pdfIndex(page: InkPage): Int? {
            val id = page.id.value
            if (!id.startsWith(PDF_PAGE_PREFIX)) return null
            return id
                .removePrefix(PDF_PAGE_PREFIX)
                .toIntOrNull()
                ?.minus(1)
                ?.takeIf { it >= 0 }
        }

        private const val PDF_PAGE_PREFIX = "pdf-"
    }
}
