package com.rickphobia.ricknotes.snip

import com.rickphobia.ricknotes.core.session.PageRect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

private val WHOLE_A4 = PageRect(0f, 0f, 595f, 842f)

class SnipFocusTest {
    @Test
    fun `an Entry without a box opens on the whole Snip`() {
        assertNull(SnipFocus.of(WHOLE_A4, box = null))
    }

    @Test
    fun `a box opens as its part of the Snip, grown by the margin`() {
        val box = PageRect(100f, 200f, 300f, 300f)

        val focus = SnipFocus.of(WHOLE_A4, box)!!

        val margin = SNIP_ZOOM_MARGIN_PT
        assertEquals((100f - margin) / 595f, focus.left, 1e-4f)
        assertEquals((200f - margin) / 842f, focus.top, 1e-4f)
        assertEquals((300f + margin) / 595f, focus.right, 1e-4f)
        assertEquals((300f + margin) / 842f, focus.bottom, 1e-4f)
    }

    @Test
    fun `a box by the page's edge stays inside the Snip`() {
        val focus = SnipFocus.of(WHOLE_A4, PageRect(0f, 830f, 50f, 842f))!!

        assertEquals(0f, focus.left)
        assertEquals(1f, focus.bottom)
    }

    @Test
    fun `the zoom fits the focus in the frame, never below the whole Snip`() {
        val focus = SnipFocus(0.25f, 0.25f, 0.75f, 0.5f)

        assertEquals(2f, focus.fitScale(), 1e-4f)
        assertEquals(1f, SnipFocus(0f, 0f, 1f, 1f).fitScale())
    }
}

class SnipPanTest {
    @Test
    fun `a zoomed picture can't be panned past its edge`() {
        assertEquals(0.25f, coveringCenter(0f, scale = 2f))
        assertEquals(0.75f, coveringCenter(1f, scale = 2f))
        assertEquals(0.4f, coveringCenter(0.4f, scale = 2f))
    }

    @Test
    fun `at scale 1 the whole picture is centred`() {
        assertEquals(0.5f, coveringCenter(0.1f, scale = 1f))
        assertEquals(0f, shiftToMiddle(0.5f, scale = 1f))
    }

    @Test
    fun `the focus's centre is shifted to the frame's middle`() {
        // Zoomed 2x about the middle, a point a quarter in sits a quarter-frame left of the middle.
        assertEquals(0.5f, shiftToMiddle(0.25f, scale = 2f))
    }
}
