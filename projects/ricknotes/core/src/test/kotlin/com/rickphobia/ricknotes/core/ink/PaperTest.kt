package com.rickphobia.ricknotes.core.ink

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PaperTest {
    @Test
    fun `a blank page has no marks`() {
        assertEquals(PaperMarks(emptyList(), emptyList(), dots = false), Paper.marks(PageBackground.BLANK))
    }

    @Test
    fun `lined paper has lines 8 mm apart under a plain top margin, and no columns`() {
        val marks = Paper.marks(PageBackground.LINED)

        assertEquals(Paper.TOP_MARGIN_PT, marks.rows.first(), DELTA)
        marks.rows.zipWithNext { a, b -> assertEquals(MM_8, b - a, DELTA) }
        assertTrue(marks.rows.last() < Paper.HEIGHT_PT)
        assertEquals(emptyList<Float>(), marks.columns)
    }

    @Test
    fun `grid and dots are 5 mm apart, start at the top margin and stay on the page`() {
        listOf(PageBackground.GRID to false, PageBackground.DOTTED to true).forEach { (background, dots) ->
            val marks = Paper.marks(background)

            assertEquals(dots, marks.dots)
            assertEquals(Paper.TOP_MARGIN_PT, marks.rows.first(), DELTA)
            (marks.rows.zipWithNext() + marks.columns.zipWithNext()).forEach { (a, b) ->
                assertEquals(MM_5, b - a, DELTA)
            }
            assertTrue(marks.columns.first() > 0f && marks.columns.last() < Paper.WIDTH_PT)
        }
    }

    @Test
    fun `the paper is A4 portrait and the lines are light grey`() {
        assertEquals(595, Paper.WIDTH_PT)
        assertEquals(842, Paper.HEIGHT_PT)
        assertFalse(Paper.marks(PageBackground.LINED).dots)
        assertEquals(0xFFD0D0D0.toInt(), Paper.LINE_COLOUR_ARGB)
    }

    private companion object {
        const val DELTA = 0.001f
        const val MM_8 = 22.677166f
        const val MM_5 = 14.173228f
    }
}
