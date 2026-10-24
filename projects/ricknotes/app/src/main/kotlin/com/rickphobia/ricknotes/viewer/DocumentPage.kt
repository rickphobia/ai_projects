package com.rickphobia.ricknotes.viewer

import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Paper
import com.rickphobia.ricknotes.core.inkfile.InkPage

/**
 * One page as the Document shows it: page [pdfIndex] of the PDF, drawn by `PdfRenderer`, or an
 * Inserted page with a [background], drawn by the app.
 */
internal data class DocumentPage(
    val id: PageId,
    val size: PageSize,
    val pdfIndex: Int?,
    val background: PageBackground?,
) {
    val inserted: Boolean get() = background != null
}

/**
 * The pages to show, in the Ink file's order, sized from [pdfSizes]. A PDF page the Ink file lists
 * but the PDF no longer has is left out: there is nothing to draw.
 */
internal fun documentPages(
    inkPages: List<InkPage>,
    pdfSizes: List<PageSize>,
): List<DocumentPage> {
    val pdfIndexOf = pdfSizes.indices.associateBy { PageId.ofPdfPage(it) }
    return inkPages.mapNotNull { page ->
        val background = page.background
        if (background != null) {
            DocumentPage(page.id, PageSize(Paper.WIDTH_PT, Paper.HEIGHT_PT), pdfIndex = null, background)
        } else {
            pdfIndexOf[page.id]?.let { DocumentPage(page.id, pdfSizes[it], it, background = null) }
        }
    }
}
