package com.rickphobia.ricknotes.snip

import com.rickphobia.ricknotes.core.session.PageRect
import com.rickphobia.ricknotes.viewer.PageSize
import com.rickphobia.ricknotes.viewer.PixelRect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private val A4 = PageSize(widthPt = 595, heightPt = 842)

class SnipRegionTest {
    @Test
    fun `a small loop is drawn at the fixed sharpness`() {
        val snip = SnipRegion.of(PageRect(100f, 200f, 150f, 230f), A4)!!

        assertEquals(595 * 4, snip.pageWidthPx)
        assertEquals(PixelRect(400, 800, 600, 920), snip.region)
    }

    @Test
    fun `a full-page loop is capped on its long edge`() {
        val snip = SnipRegion.of(PageRect(0f, 0f, 595f, 842f), A4)!!

        assertTrue(snip.region.height <= SNIP_MAX_LONG_EDGE_PX)
        assertTrue(snip.region.height >= SNIP_MAX_LONG_EDGE_PX - 2)
        assertEquals(snip.pageWidthPx, snip.region.width)
    }

    @Test
    fun `a loop past the page's edge is cut to the page`() {
        val snip = SnipRegion.of(PageRect(-20f, 800f, 100f, 900f), A4)!!

        assertEquals(0, snip.region.left)
        assertEquals(A4.heightPx(snip.pageWidthPx), snip.region.bottom)
    }

    @Test
    fun `a loop wholly off the page has no Snip`() {
        assertNull(SnipRegion.of(PageRect(600f, 10f, 700f, 50f), A4))
    }
}
