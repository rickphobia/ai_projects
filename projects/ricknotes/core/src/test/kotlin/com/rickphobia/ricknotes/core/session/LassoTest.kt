package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePoint
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.Tool
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LassoTest {
    private val page = PageId.ofPdfPage(0)

    // A stroke through these (x, y) points, 2 pt wide.
    private fun stroke(
        id: String,
        vararg xy: Pair<Float, Float>,
        pageId: PageId = page,
    ) = Stroke(
        StrokeId(id),
        pageId,
        Tool.PEN,
        0,
        widthPt = 2f,
        drawnAtMs = 0,
        points = xy.mapIndexed { i, (x, y) -> StrokePoint(x, y, 0.5f, i.toLong()) },
    )

    // A square loop from (0, 0) to (100, 100), drawn as the pen would: not closed.
    private val square = listOf(PagePoint(0f, 0f), PagePoint(100f, 0f), PagePoint(100f, 100f), PagePoint(0f, 100f))

    private fun inLoop(
        strokes: List<Stroke>,
        loop: List<PagePoint> = square,
    ) = strokesInLoop(strokes, page, loop).map { it.id.value }

    @Test
    fun `a stroke wholly inside the loop is selected and one wholly outside is not`() {
        val strokes = listOf(stroke("in", 10f to 10f, 90f to 90f), stroke("out", 110f to 10f, 190f to 90f))

        assertEquals(listOf("in"), inLoop(strokes))
    }

    @Test
    fun `a stroke the loop cuts through is selected only if most of its points are inside`() {
        val mostlyIn = stroke("mostly in", 50f to 50f, 70f to 50f, 90f to 50f, 120f to 50f)
        val mostlyOut = stroke("mostly out", 90f to 60f, 120f to 60f, 140f to 60f, 160f to 60f)

        assertEquals(listOf("mostly in"), inLoop(listOf(mostlyIn, mostlyOut)))
    }

    @Test
    fun `the loop closes itself, and an odd shape like an L works`() {
        val ell =
            listOf(
                PagePoint(0f, 0f),
                PagePoint(20f, 0f),
                PagePoint(20f, 80f),
                PagePoint(100f, 80f),
                PagePoint(100f, 100f),
                PagePoint(0f, 100f),
            )
        val inTheFoot = stroke("foot", 50f to 90f, 60f to 90f)
        val inTheNotch = stroke("notch", 50f to 40f, 60f to 40f)

        assertEquals(listOf("foot"), inLoop(listOf(inTheFoot, inTheNotch), ell))
    }

    @Test
    fun `only strokes on the loop's page are selected`() {
        val strokes = listOf(stroke("here", 10f to 10f), stroke("next page", 10f to 10f, pageId = PageId.ofPdfPage(1)))

        assertEquals(listOf("here"), inLoop(strokes))
    }

    @Test
    fun `a tap or a line is not a loop and selects nothing`() {
        val strokes = listOf(stroke("a", 10f to 10f))

        assertEquals(emptyList<String>(), inLoop(strokes, listOf(PagePoint(10f, 10f))))
        assertEquals(emptyList<String>(), inLoop(strokes, listOf(PagePoint(0f, 0f), PagePoint(100f, 100f))))
    }

    @Test
    fun `a selection's bounds take in each stroke's full width`() {
        val bounds = boundsOf(listOf(stroke("a", 10f to 20f, 30f to 40f), stroke("b", 50f to 5f)))

        assertEquals(PageRect(left = 9f, top = 4f, right = 51f, bottom = 41f), bounds)
        assertNull(boundsOf(emptyList()))
    }

    @Test
    fun `a drag is cut short so the selection stays on the page`() {
        val bounds = PageRect(left = 10f, top = 10f, right = 50f, bottom = 50f)

        assertEquals(PageOffset(5f, 20f), bounds.keepOnPage(PageOffset(5f, 20f), widthPt = 100f, heightPt = 100f))
        assertEquals(PageOffset(-10f, 50f), bounds.keepOnPage(PageOffset(-30f, 80f), widthPt = 100f, heightPt = 100f))
    }

    @Test
    fun `a selection already past the page's edge can still be dragged back but not further out`() {
        val pokingOutLeft = PageRect(left = -5f, top = 10f, right = 50f, bottom = 50f)

        assertEquals(
            PageOffset(0f, 0f),
            pokingOutLeft.keepOnPage(PageOffset(-10f, 0f), widthPt = 100f, heightPt = 100f),
        )
        assertEquals(
            PageOffset(30f, 0f),
            pokingOutLeft.keepOnPage(PageOffset(30f, 0f), widthPt = 100f, heightPt = 100f),
        )
    }

    @Test
    fun `a moved stroke keeps its ID and everything but its position`() {
        val moved = stroke("a", 10f to 20f).movedBy(PageOffset(5f, -5f))

        assertEquals(stroke("a", 15f to 15f), moved)
    }
}
