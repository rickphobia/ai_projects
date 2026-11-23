package com.rickphobia.ricknotes.core.export

import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Paper
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.PictureFrame
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.session.DocumentSession
import com.rickphobia.ricknotes.core.session.FakeClock
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files
import java.nio.file.Path

class ExportPlanTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = FakeClock()
    private val pdf: Path by lazy {
        folder.root
            .toPath()
            .resolve("Week 3 tutorial.pdf")
            .also { Files.write(it, "%PDF-1.7 not really".toByteArray()) }
    }
    private val inkFile: Path get() = pdf.resolveSibling("Week 3 tutorial.pdf.ink.json")

    private fun open(pdfPageCount: Int = 3) = DocumentSession.open(pdf, pdfPageCount, clock)

    private fun stroke(
        id: String,
        page: PageId,
        tool: InkTool = InkTool.Pen(PenColour.BLACK),
    ) = Stroke(
        StrokeId(id),
        page,
        tool.tool,
        tool.colourArgb,
        tool.widthPt,
        drawnAtMs = 1_760_000_000_000,
        points = listOf(StrokePoint(10f, 20f, 0.5f, 0), StrokePoint(30f, 40f, 0.6f, 12)),
    )

    private fun plan(
        session: DocumentSession,
        inkWanted: Boolean = true,
    ) = ExportPlan.of(session.snapshot(), inkWanted)

    private fun withInk(session: DocumentSession): ExportPlan.WithInk {
        val plan = plan(session)
        assertTrue("expected With ink, was $plan", plan is ExportPlan.WithInk)
        return plan as ExportPlan.WithInk
    }

    @Test
    fun `a Document with no strokes, Pictures or Inserted pages goes bare`() {
        assertEquals(ExportPlan.Bare, plan(open()))
    }

    @Test
    fun `ink not wanted goes bare even with strokes`() {
        val session = open().apply { addStroke(stroke("a", PageId.ofPdfPage(0))) }

        assertEquals(ExportPlan.Bare, plan(session, inkWanted = false))
    }

    @Test
    fun `every page comes out in order, each stroke on its own page in the order written`() {
        val session = open()
        val first = stroke("first", PageId.ofPdfPage(2))
        val onPageOne = stroke("one", PageId.ofPdfPage(0))
        val second = stroke("second", PageId.ofPdfPage(2))
        listOf(first, onPageOne, second).forEach(session::addStroke)

        val plan = withInk(session)

        assertEquals(
            listOf(
                ExportPage.FromPdf(0, listOf(onPageOne), emptyList()),
                ExportPage.FromPdf(1, emptyList(), emptyList()),
                ExportPage.FromPdf(2, listOf(first, second), emptyList()),
            ),
            plan.pages,
        )
        assertEquals(3, plan.strokeCount)
        assertEquals(0, plan.insertedCount)
    }

    @Test
    fun `strokes keep their tool, colour and width in PDF points, the highlighter included`() {
        val session = open()
        val red = stroke("red", PageId.ofPdfPage(0), InkTool.Pen(PenColour.RED))
        val highlight = stroke("highlight", PageId.ofPdfPage(0), InkTool.Highlighter)
        session.addStroke(red)
        session.addStroke(highlight)

        val planned = withInk(session).pages.first().strokes

        assertEquals(listOf(red, highlight), planned)
        assertEquals(InkTool.Highlighter.tool, planned[1].tool)
        assertEquals(InkTool.Highlighter.colourArgb, planned[1].colourArgb)
        assertEquals(InkTool.Highlighter.widthPt, planned[1].widthPt)
    }

    @Test
    fun `Inserted pages come out in their place as A4 pages with their strokes`() {
        val session = open()
        val inserted = session.insertPageAfter(PageId.ofPdfPage(0), PageBackground.LINED)
        val onIt = stroke("working", inserted.id)
        session.addStroke(onIt)

        val plan = withInk(session)

        assertEquals(
            listOf(
                ExportPage.FromPdf(0, emptyList(), emptyList()),
                ExportPage.Inserted(PageBackground.LINED, listOf(onIt), emptyList()),
                ExportPage.FromPdf(1, emptyList(), emptyList()),
                ExportPage.FromPdf(2, emptyList(), emptyList()),
            ),
            plan.pages,
        )
        val page = plan.pages[1] as ExportPage.Inserted
        assertEquals(Paper.WIDTH_PT.toFloat(), page.widthPt)
        assertEquals(Paper.HEIGHT_PT.toFloat(), page.heightPt)
        assertEquals(1, plan.insertedCount)
    }

    @Test
    fun `an Inserted page with no strokes still makes the Document go with ink`() {
        val session = open().apply { insertPageAfter(PageId.ofPdfPage(2), PageBackground.BLANK) }

        assertEquals(4, withInk(session).pages.size)
    }

    private fun placePicture(
        session: DocumentSession,
        page: PageId,
        frame: PictureFrame = PictureFrame(left = 40f, top = 60f, widthPt = 200f, heightPt = 120f),
    ) = session.placePicture(
        folder.newFile().toPath().also { Files.write(it, byteArrayOf(1, 2, 3)) },
        "png",
        page,
        frame,
    )

    @Test
    fun `Pictures come out on their own page at their position and size, before its strokes`() {
        val session = open()
        val under = stroke("under", PageId.ofPdfPage(1))
        session.addStroke(under)
        val picture = placePicture(session, PageId.ofPdfPage(1))
        val second = placePicture(session, PageId.ofPdfPage(1), PictureFrame(10f, 500f, 80f, 40f))

        val plan = withInk(session)

        val page = plan.pages[1]
        assertEquals(listOf(picture, second), page.pictures)
        assertEquals(listOf(under), page.strokes)
        with(page.pictures[0]) { assertEquals(listOf(40f, 60f, 200f, 120f), listOf(left, top, widthPt, heightPt)) }
        assertTrue(plan.pages[0].pictures.isEmpty() && plan.pages[2].pictures.isEmpty())
        assertEquals(2, plan.pictureCount)
    }

    @Test
    fun `a Picture on an Inserted page comes out on that page`() {
        val session = open()
        val inserted = session.insertPageAfter(PageId.ofPdfPage(0), PageBackground.GRID)
        val picture = placePicture(session, inserted.id)

        val plan = withInk(session)

        assertEquals(ExportPage.Inserted(PageBackground.GRID, emptyList(), listOf(picture)), plan.pages[1])
    }

    @Test
    fun `a Document with only Pictures goes with ink`() {
        val session = open().apply { placePicture(this, PageId.ofPdfPage(2)) }

        assertEquals(1, withInk(session).pictureCount)
    }

    @Test
    fun `pages the PDF no longer has are left out, with their strokes`() {
        open(pdfPageCount = 3).apply {
            addStroke(stroke("kept", PageId.ofPdfPage(0)))
            addStroke(stroke("gone", PageId.ofPdfPage(2)))
            saveNow()
        }

        val plan = withInk(open(pdfPageCount = 2))

        assertEquals(listOf(0, 1), plan.pages.map { (it as ExportPage.FromPdf).index })
        assertEquals(1, plan.strokeCount)
    }

    @Test
    fun `a damaged Ink file gives Ink unreadable`() {
        Files.writeString(inkFile, "{\"formatVersion\": 1, \"strokes\": [{")

        assertEquals(ExportPlan.InkUnreadable, plan(open()))
    }

    @Test
    fun `a waiting Conflict copy gives Pick a side first`() {
        open().apply {
            addStroke(stroke("mine", PageId.ofPdfPage(0)))
            saveNow()
        }
        Files.copy(inkFile, pdf.resolveSibling("Week 3 tutorial.pdf.ink (1).json"))

        assertEquals(ExportPlan.PickASideFirst, plan(open()))
    }

    @Test
    fun `a stroke added after the snapshot is not in the plan`() {
        val session = open().apply { addStroke(stroke("before", PageId.ofPdfPage(0))) }
        val snapshot = session.snapshot()

        session.addStroke(stroke("after", PageId.ofPdfPage(0)))

        val plan = ExportPlan.of(snapshot, inkWanted = true) as ExportPlan.WithInk
        assertEquals(listOf(StrokeId("before")), plan.pages.flatMap { it.strokes }.map { it.id })
    }
}
