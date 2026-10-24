package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.PictureFrame
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.Tool
import com.rickphobia.ricknotes.core.inkfile.InkFile
import com.rickphobia.ricknotes.core.inkfile.InkPage
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files
import java.nio.file.Path

class DocumentSessionPagesTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = FakeClock()
    private val pdf: Path by lazy {
        folder.root
            .toPath()
            .resolve("lecture.pdf")
            .also { Files.write(it, PDF_BYTES) }
    }

    private fun open() = DocumentSession.open(pdf, 3, clock)

    private fun stroke(
        id: String,
        page: PageId,
    ) = Stroke(
        StrokeId(id),
        page,
        Tool.PEN,
        PenColour.BLACK.argb,
        InkTool.Pen(PenColour.BLACK).widthPt,
        drawnAtMs = 1_760_000_000_000,
        points = listOf(StrokePoint(10f, 20f, 0.5f, 0)),
    )

    private val pdfPages = InkFile.pdfPages(3)

    @Test
    fun `a Document opens with the PDF's own pages in order`() {
        assertEquals(pdfPages, open().pages)
    }

    @Test
    fun `inserting a page puts it right after the chosen page, with its background, as one undo step`() {
        val session = open()

        val lined = session.insertPageAfter(PageId.ofPdfPage(0), PageBackground.LINED)

        assertEquals(PageBackground.LINED, lined.background)
        assertEquals(listOf(pdfPages[0], lined, pdfPages[1], pdfPages[2]), session.pages)
        assertTrue(session.undo())
        assertEquals(pdfPages, session.pages)
        assertTrue(session.redo())
        assertEquals(listOf(pdfPages[0], lined, pdfPages[1], pdfPages[2]), session.pages)
    }

    @Test
    fun `each Inserted page has an ID of its own, so the PDF's pages keep theirs`() {
        val session = open()

        val first = session.insertPageAfter(PageId.ofPdfPage(2), PageBackground.GRID)
        val second = session.insertPageAfter(first.id, PageBackground.DOTTED)

        assertNotEquals(first.id, second.id)
        assertEquals(pdfPages + listOf(first, second), session.pages)
    }

    @Test
    fun `Inserted pages and their ink are there on reopening, and the PDF is unchanged`() {
        val page =
            open().run {
                val page = insertPageAfter(PageId.ofPdfPage(1), PageBackground.GRID)
                addStroke(stroke("a", page.id))
                saveNow()
                page
            }

        val reopened = open()

        assertEquals(listOf(pdfPages[0], pdfPages[1], page, pdfPages[2]), reopened.pages)
        assertEquals(listOf(stroke("a", page.id)), reopened.strokes)
        assertArrayEquals(PDF_BYTES, Files.readAllBytes(pdf))
    }

    @Test
    fun `removing an Inserted page takes its ink with it, and undo brings the page and ink back in place`() {
        val session = open()
        val page = session.insertPageAfter(PageId.ofPdfPage(0), PageBackground.LINED)
        session.addStroke(stroke("before", PageId.ofPdfPage(0)))
        session.addStroke(stroke("on it", page.id))
        session.addStroke(stroke("after", PageId.ofPdfPage(1)))
        val picture = session.placePicture(image(), "png", page.id, PictureFrame(10f, 10f, 100f, 50f))

        assertTrue(session.removePage(page.id))

        assertEquals(pdfPages, session.pages)
        assertEquals(listOf("before", "after"), session.strokes.map { it.id.value })
        assertEquals(emptyList<Any>(), session.pictures)
        assertTrue(session.undo())
        assertEquals(listOf(pdfPages[0], page, pdfPages[1], pdfPages[2]), session.pages)
        assertEquals(listOf("before", "on it", "after"), session.strokes.map { it.id.value })
        assertEquals(listOf(picture), session.pictures)
    }

    @Test
    fun `a removed page stays removed after a save and reopen`() {
        open().run {
            val page = insertPageAfter(PageId.ofPdfPage(0), PageBackground.BLANK)
            addStroke(stroke("on it", page.id))
            removePage(page.id)
            saveNow()
        }

        val reopened = open()

        assertEquals(pdfPages, reopened.pages)
        assertEquals(emptyList<Stroke>(), reopened.strokes)
    }

    @Test
    fun `a PDF's own page can't be removed`() {
        val session = open()

        assertThrows(IllegalArgumentException::class.java) { session.removePage(PageId.ofPdfPage(1)) }
        assertEquals(pdfPages, session.pages)
        assertFalse(session.canUndo)
    }

    @Test
    fun `removing a page that isn't here is not an undo step`() {
        val session = open()

        assertFalse(session.removePage(PageId("inserted-gone")))
        assertFalse(session.canUndo)
    }

    @Test
    fun `a page has ink when it has a stroke or a Picture on it`() {
        val session = open()
        val written = session.insertPageAfter(PageId.ofPdfPage(0), PageBackground.LINED)
        val pictured = session.insertPageAfter(written.id, PageBackground.LINED)
        val empty = session.insertPageAfter(pictured.id, PageBackground.LINED)
        session.addStroke(stroke("a", written.id))
        session.placePicture(image(), "png", pictured.id, PictureFrame(10f, 10f, 100f, 50f))

        assertTrue(session.hasInk(written.id))
        assertTrue(session.hasInk(pictured.id))
        assertFalse(session.hasInk(empty.id))
    }

    @Test
    fun `an Inserted page takes Pictures like any page`() {
        val session = open()
        val page = session.insertPageAfter(PageId.ofPdfPage(0), PageBackground.DOTTED)

        val picture = session.placePicture(image(), "png", page.id, PictureFrame(10f, 10f, 100f, 50f))

        assertEquals(page.id, picture.pageId)
    }

    @Test
    fun `a read-only Document can't insert or remove pages`() {
        Files.writeString(pdf.resolveSibling("lecture.pdf.ink.json"), "not JSON")
        val session = open()

        assertThrows(IllegalStateException::class.java) {
            session.insertPageAfter(PageId.ofPdfPage(0), PageBackground.LINED)
        }
        assertThrows(IllegalStateException::class.java) { session.removePage(PageId("inserted-x")) }
        assertEquals(pdfPages, session.pages)
    }

    @Test
    fun `an Inserted page is kept even if the PDF loses pages`() {
        val page =
            open().run {
                insertPageAfter(PageId.ofPdfPage(2), PageBackground.LINED).also { saveNow() }
            }

        val pages = DocumentSession.open(pdf, 2, clock).pages

        assertTrue(page in pages)
        assertEquals(InkPage(PageId.ofPdfPage(0)), pages.first())
    }

    private fun image(): Path =
        folder.root
            .toPath()
            .resolve("drop.png")
            .also { Files.write(it, byteArrayOf(1, 2, 3)) }

    private companion object {
        val PDF_BYTES = "%PDF-1.7 not really".toByteArray()
    }
}
