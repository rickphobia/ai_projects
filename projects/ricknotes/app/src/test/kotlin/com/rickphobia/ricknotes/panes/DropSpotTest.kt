package com.rickphobia.ricknotes.panes

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DropSpotTest {
    private val panes = mapOf(0 to Rect(0f, 0f, 500f, 800f), 1 to Rect(500f, 0f, 1000f, 800f))

    @Test
    fun `a drop lands on the Pane under it`() {
        assertEquals(1, paneAt(panes, Offset(700f, 400f)))
        assertEquals(0, paneAt(panes, Offset(100f, 400f)))
    }

    @Test
    fun `a drop outside every Pane lands nowhere`() {
        assertNull(paneAt(panes, Offset(700f, 900f)))
    }

    @Test
    fun `a drop on the Pane a Tab came from lands nowhere`() {
        assertNull(paneAt(panes, Offset(100f, 400f), from = 0))
        assertEquals(1, paneAt(panes, Offset(700f, 400f), from = 0))
    }

    @Test
    fun `a drop on the tree drawer lands nowhere, though a Pane lies under it`() {
        val drawer = Rect(0f, 0f, 300f, 800f)

        assertNull(paneAt(panes, Offset(100f, 400f), covered = drawer))
        assertEquals(0, paneAt(panes, Offset(400f, 400f), covered = drawer))
    }
}
