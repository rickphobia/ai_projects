package com.rickphobia.ricknotes.ink

import org.junit.Assert.assertEquals
import org.junit.Test

class LassoMenuSpotTest {
    private val screen = ScreenSize(1000f, 800f)
    private val menu = ScreenSize(200f, 50f)

    @Test
    fun `the menu sits just below the selection, lined up with its left edge`() {
        val box = ScreenBox(100f, 100f, 300f, 200f)

        assertEquals(MenuSpot(100f, 210f), lassoMenuSpot(box, menu, screen, gap = 10f))
    }

    @Test
    fun `near the bottom of the screen it goes above the selection`() {
        val box = ScreenBox(100f, 600f, 300f, 780f)

        assertEquals(MenuSpot(100f, 540f), lassoMenuSpot(box, menu, screen, gap = 10f))
    }

    @Test
    fun `a selection filling the screen's height keeps the menu inside the screen`() {
        val box = ScreenBox(100f, -50f, 300f, 900f)

        assertEquals(MenuSpot(100f, 750f), lassoMenuSpot(box, menu, screen, gap = 10f))
    }

    @Test
    fun `near the right edge the menu is pulled back onto the screen`() {
        val box = ScreenBox(900f, 100f, 1100f, 200f)

        assertEquals(MenuSpot(800f, 210f), lassoMenuSpot(box, menu, screen, gap = 10f))
    }

    @Test
    fun `a selection past the left edge keeps the menu at the left edge`() {
        val box = ScreenBox(-150f, 100f, 50f, 200f)

        assertEquals(MenuSpot(0f, 210f), lassoMenuSpot(box, menu, screen, gap = 10f))
    }
}
