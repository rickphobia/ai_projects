package com.rickphobia.ricknotes.viewer

import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.core.inkfile.InkFile
import com.rickphobia.ricknotes.core.inkfile.InkPage
import org.junit.Assert.assertEquals
import org.junit.Test

class PagePlacementsTest {
    private val sizes = listOf(PageSize(720, 540), PageSize(595, 842))

    @Test
    fun `each laid-out page is placed after the gap, slid left by the pan, at its zoomed scale`() {
        val visible = listOf(VisiblePage(1, top = -300, height = 4245))

        val placements =
            pagePlacements(
                visible,
                documentPages(InkFile.pdfPages(2), sizes),
                pageWidthPx = 3000,
                gapPx = 20,
                view = ZoomView(2f, panX = 500f),
            )

        assertEquals(
            listOf(PagePlacement(PageId.ofPdfPage(1), left = -480f, top = -300f, 3000f / 595, 595f, 842f)),
            placements,
        )
    }

    @Test
    fun `an Inserted page is placed by its own ID and A4 size, and the PDF page after it keeps its ID`() {
        val inserted = InkPage(PageId("inserted-1"), PageBackground.LINED)
        val pages = documentPages(listOf(InkFile.pdfPages(2)[0], inserted, InkFile.pdfPages(2)[1]), sizes)
        val visible = listOf(VisiblePage(1, top = 0, height = 1415), VisiblePage(2, top = 1423, height = 1415))

        val placements = pagePlacements(visible, pages, pageWidthPx = 1000, gapPx = 8, view = ZoomView(1f, panX = 0f))

        assertEquals(listOf(PageId("inserted-1"), PageId.ofPdfPage(1)), placements.map { it.pageId })
        assertEquals(595f to 842f, placements[0].widthPt to placements[0].heightPt)
    }

    @Test
    fun `a laid-out page that was just removed is left out`() {
        val visible = listOf(VisiblePage(1, top = 0, height = 100), VisiblePage(2, top = 108, height = 100))

        val placements =
            pagePlacements(visible, documentPages(InkFile.pdfPages(2), sizes), 1000, 8, ZoomView(1f, panX = 0f))

        assertEquals(listOf(PageId.ofPdfPage(1)), placements.map { it.pageId })
    }
}
