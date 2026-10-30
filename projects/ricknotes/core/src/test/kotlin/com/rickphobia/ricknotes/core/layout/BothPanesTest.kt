package com.rickphobia.ricknotes.core.layout

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BothPanesTest {
    private val start = TabPosition(pageIndex = 0, zoom = 1f)

    // Lecture in the first Pane, tutorial selected in the second, as in the tutorial routine.
    private fun lectureAndTutorial() =
        Layout()
            .open("EE2001/lecture 3.pdf", start)
            .split()
            .open("EE2001/tutorial 3.pdf", start)

    @Test
    fun `two Panes with different Documents give the other Pane's Document, from either Pane`() {
        val layout = lectureAndTutorial()

        assertEquals("EE2001/tutorial 3.pdf", layout.otherPaneDocument(0)?.path)
        assertEquals("EE2001/lecture 3.pdf", layout.otherPaneDocument(1)?.path)
    }

    @Test
    fun `only the other Pane's selected Tab counts`() {
        val layout = lectureAndTutorial().open("EE2001/notes.pdf", start, pane = 0).select(0, 0)

        assertEquals("EE2001/tutorial 3.pdf", layout.otherPaneDocument(0)?.path)
        assertEquals("EE2001/lecture 3.pdf", layout.otherPaneDocument(1)?.path)
    }

    @Test
    fun `one Pane gives none`() {
        val layout = Layout().open("EE2001/lecture 3.pdf", start).open("EE2001/tutorial 3.pdf", start)

        assertNull(layout.otherPaneDocument(0))
    }

    @Test
    fun `the same Document in both Panes gives none`() {
        val layout = Layout().open("EE2001/lecture 3.pdf", start).split()

        assertNull(layout.otherPaneDocument(0))
        assertNull(layout.otherPaneDocument(1))
    }

    @Test
    fun `a missing Document in the other Pane gives none`() {
        val layout = lectureAndTutorial().checkMissing { it != "EE2001/tutorial 3.pdf" }

        assertNull(layout.otherPaneDocument(0))
    }

    @Test
    fun `a Pane that isn't there gives none`() {
        assertNull(lectureAndTutorial().otherPaneDocument(2))
        assertNull(Layout().otherPaneDocument(0))
    }
}
