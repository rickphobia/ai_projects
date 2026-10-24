package com.rickphobia.ricknotes.viewer

import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.inkfile.InkFile
import com.rickphobia.ricknotes.core.inkfile.InkPage
import org.junit.Assert.assertEquals
import org.junit.Test

class DocumentPageTest {
    private val sizes = listOf(PageSize(720, 540), PageSize(595, 842), PageSize(612, 792))

    @Test
    fun `PDF pages keep their PDF index and size, and Inserted pages are A4 with their background`() {
        val grid = InkPage(PageId("inserted-1"), PageBackground.GRID)
        val pdf = InkFile.pdfPages(3)

        val pages = documentPages(listOf(pdf[0], grid, pdf[1], pdf[2]), sizes)

        assertEquals(
            listOf(
                DocumentPage(PageId.ofPdfPage(0), sizes[0], 0, null),
                DocumentPage(PageId("inserted-1"), PageSize(595, 842), null, PageBackground.GRID),
                DocumentPage(PageId.ofPdfPage(1), sizes[1], 1, null),
                DocumentPage(PageId.ofPdfPage(2), sizes[2], 2, null),
            ),
            pages,
        )
    }

    @Test
    fun `a PDF page the PDF no longer has is left out`() {
        val pages = documentPages(InkFile.pdfPages(3), sizes.take(2))

        assertEquals(listOf(0, 1), pages.map { it.pdfIndex })
    }
}
