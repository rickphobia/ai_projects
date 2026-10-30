package com.rickphobia.ricknotes.core.redink

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.Tool
import com.rickphobia.ricknotes.core.session.PageRect
import org.junit.Assert.assertEquals
import org.junit.Test

class RedMarksTest {
    // A4 portrait: the shorter side is 595 pt, so the distance limit is 119 pt.
    private val page1 = MarkedPage(PageId.ofPdfPage(0), widthPt = 595f, heightPt = 842f)
    private val page2 = MarkedPage(PageId.ofPdfPage(1), widthPt = 595f, heightPt = 842f)
    private val pages = listOf(page1, page2)

    private val red = PenColour.RED.argb
    private val second = 1_000L

    // Long after every stroke in these tests, so each group is old enough to be offered.
    private val later = 3_600 * second

    // A short stroke from [at] (x, y) to (x + 10, y + 10), drawn at [atMs] and taking 100 ms,
    // with [pen]'s tool and colour.
    private fun stroke(
        id: String,
        at: Pair<Float, Float>,
        atMs: Long,
        page: MarkedPage = page1,
        pen: Pair<Tool, Int> = Tool.PEN to red,
    ) = Stroke(
        StrokeId(id),
        page.id,
        pen.first,
        pen.second,
        widthPt = 2f,
        drawnAtMs = atMs,
        points =
            listOf(
                StrokePoint(at.first, at.second, 0.5f, 0),
                StrokePoint(at.first + 10, at.second + 10, 0.5f, 100),
            ),
    )

    private fun marks(
        strokes: List<Stroke>,
        nowMs: Long = later,
        leftOut: Set<StrokeId> = emptySet(),
    ) = RedMarks.find(strokes, pages, nowMs, leftOut).map { mark -> mark.strokeIds.map { it.value } }

    @Test
    fun `only red pen strokes count, never the highlighter or other pens`() {
        val strokes =
            listOf(
                stroke("red", 100f to 100f, 0),
                stroke("black", 300f to 300f, 0, pen = Tool.PEN to PenColour.BLACK.argb),
                stroke("blue", 300f to 500f, 0, pen = Tool.PEN to PenColour.BLUE.argb),
                stroke("red highlighter", 300f to 700f, 0, pen = Tool.HIGHLIGHTER to red),
            )

        assertEquals(listOf(listOf("red")), marks(strokes))
        assertEquals(listOf(StrokeId("red")), RedMarks.redInk(strokes))
    }

    @Test
    fun `strokes close in time and on the page make one Red mark, with every stroke in its box`() {
        val strokes =
            listOf(
                stroke("cross", 100f to 100f, 0),
                stroke("fix", 150f to 120f, 20 * second),
                stroke("note", 200f to 140f, 50 * second),
            )

        val found = RedMarks.find(strokes, pages, later, emptySet())

        assertEquals(listOf(listOf("cross", "fix", "note")), found.map { mark -> mark.strokeIds.map { it.value } })
        assertEquals(page1.id, found.single().pageId)
        assertEquals(PageRect(99f, 99f, 211f, 151f), found.single().box)
    }

    @Test
    fun `a stroke more than the time limit after the group's last one starts another Red mark`() {
        val pause = RedMarks.TIME_LIMIT_MS + 1
        val strokes =
            listOf(
                stroke("first", 100f to 100f, 0),
                // The first stroke ends 100 ms after it starts; the limit counts from there.
                stroke("just in time", 110f to 110f, RedMarks.TIME_LIMIT_MS + 100),
                stroke("too late", 120f to 120f, RedMarks.TIME_LIMIT_MS + 200 + pause),
            )

        assertEquals(listOf(listOf("first", "just in time"), listOf("too late")), marks(strokes))
    }

    @Test
    fun `a stroke past the distance limit from the group starts another Red mark, even straight after`() {
        // The first box ends at 111 pt and "near"'s starts at 228: 117 pt apart, inside a fifth of 595 (119).
        val strokes =
            listOf(
                stroke("question 1", 100f to 100f, 0),
                stroke("near", 229f to 100f, second),
                stroke("question 2", 100f to 600f, 2 * second),
            )

        assertEquals(listOf(listOf("question 1", "near"), listOf("question 2")), marks(strokes))
    }

    @Test
    fun `the distance is measured from the group's whole box, so a growing mark keeps its strokes`() {
        val strokes =
            listOf(
                stroke("a", 100f to 100f, 0),
                stroke("b", 200f to 100f, second),
                stroke("c", 300f to 100f, 2 * second),
            )

        assertEquals(listOf(listOf("a", "b", "c")), marks(strokes))
    }

    @Test
    fun `strokes on different pages stay separate, however close`() {
        val strokes =
            listOf(
                stroke("on page 1", 100f to 100f, 0),
                stroke("on page 2", 100f to 100f, second, page = page2),
            )

        assertEquals(listOf(listOf("on page 1"), listOf("on page 2")), marks(strokes))
    }

    @Test
    fun `a group whose last stroke is under a minute old isn't offered yet`() {
        val strokes =
            listOf(
                stroke("old", 100f to 100f, 0),
                stroke("still writing", 100f to 600f, 100 * second),
            )
        // "still writing" ended at 100.1 s.
        val endOfLast = 100 * second + 100

        assertEquals(listOf(listOf("old")), marks(strokes, nowMs = endOfLast + RedMarks.SETTLE_MS))
        assertEquals(
            listOf(listOf("old"), listOf("still writing")),
            marks(strokes, nowMs = endOfLast + RedMarks.SETTLE_MS + 1),
        )
    }

    @Test
    fun `left-out strokes are skipped, and new ink beside them makes a new Red mark`() {
        val strokes =
            listOf(
                stroke("logged", 100f to 100f, 0),
                stroke("second attempt", 120f to 120f, 10 * second),
            )

        assertEquals(listOf(listOf("second attempt")), marks(strokes, leftOut = setOf(StrokeId("logged"))))
    }

    @Test
    fun `three red marks on two pages give three Red marks, in page order then by time`() {
        val strokes =
            listOf(
                stroke("page 2 mark", 100f to 100f, 0, page = page2),
                stroke("page 1 lower", 100f to 600f, second),
                stroke("page 1 lower fix", 130f to 620f, 2 * second),
                stroke("page 1 upper", 100f to 100f, 3 * second),
            )

        assertEquals(
            listOf(listOf("page 1 lower", "page 1 lower fix"), listOf("page 1 upper"), listOf("page 2 mark")),
            marks(strokes),
        )
    }

    @Test
    fun `strokes are grouped in the order they were drawn, whatever order they come in`() {
        val strokes =
            listOf(
                stroke("third", 120f to 120f, 2 * second),
                stroke("first", 100f to 100f, 0),
                stroke("second", 110f to 110f, second),
            )

        assertEquals(listOf(listOf("first", "second", "third")), marks(strokes))
    }

    @Test
    fun `the distance limit follows the page's shorter side`() {
        val landscape = MarkedPage(PageId("inserted-wide"), widthPt = 842f, heightPt = 300f)
        // A fifth of 300 is 60: the second box starts 69 pt right of the first, past it.
        val strokes =
            listOf(
                stroke("left", 100f to 100f, 0, page = landscape),
                stroke("right", 181f to 100f, second, page = landscape),
            )

        val found = RedMarks.find(strokes, listOf(landscape), later, emptySet())

        assertEquals(listOf(listOf("left"), listOf("right")), found.map { mark -> mark.strokeIds.map { it.value } })
    }

    @Test
    fun `strokes on a page that isn't shown are left out`() {
        val gone = MarkedPage(PageId("inserted-removed"), 595f, 842f)

        assertEquals(
            emptyList<List<String>>(),
            marks(listOf(stroke("on a removed page", 100f to 100f, 0, page = gone))),
        )
    }
}
