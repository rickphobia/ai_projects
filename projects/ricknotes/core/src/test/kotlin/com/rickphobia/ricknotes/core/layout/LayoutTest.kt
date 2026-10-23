package com.rickphobia.ricknotes.core.layout

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LayoutTest {
    private val start = TabPosition(pageIndex = 0, zoom = 1f)

    private fun opened(vararg paths: String) = paths.fold(Layout()) { layout, path -> layout.open(path, start) }

    private fun Layout.paths() = panes.single().tabs.map { it.path }

    @Test
    fun `an empty Layout has no Pane and no selected Tab`() {
        assertTrue(Layout().panes.isEmpty())
        assertNull(Layout().selectedTab)
    }

    @Test
    fun `opening a Document adds a Tab after the others and selects it`() {
        val layout = opened("Y1/a.pdf", "Y1/b.pdf")

        assertEquals(listOf("Y1/a.pdf", "Y1/b.pdf"), layout.paths())
        assertEquals("Y1/b.pdf", layout.selectedTab?.path)
    }

    @Test
    fun `a new Tab starts at the position it is opened at`() {
        val layout = Layout().open("Y1/a.pdf", TabPosition(pageIndex = 4, zoom = 2f))

        assertEquals(Tab("Y1/a.pdf", TabPosition(4, 2f)), layout.selectedTab)
    }

    @Test
    fun `opening a Document that is already open selects its Tab where it was`() {
        val layout =
            opened("Y1/a.pdf", "Y1/b.pdf")
                .moved(0, 0, TabPosition(7, 1.5f))
                .open("Y1/a.pdf", start)

        assertEquals(listOf("Y1/a.pdf", "Y1/b.pdf"), layout.paths())
        assertEquals(Tab("Y1/a.pdf", TabPosition(7, 1.5f)), layout.selectedTab)
    }

    @Test
    fun `opening at a position moves an open Tab there too`() {
        val layout = opened("Y1/a.pdf", "Y1/b.pdf").openAt("Y1/a.pdf", TabPosition(9, 1.5f))

        assertEquals(listOf("Y1/a.pdf", "Y1/b.pdf"), layout.paths())
        assertEquals(Tab("Y1/a.pdf", TabPosition(9, 1.5f)), layout.selectedTab)
    }

    @Test
    fun `selecting a Tab keeps every Tab's position`() {
        val layout =
            opened("Y1/a.pdf", "Y1/b.pdf")
                .moved(0, 1, TabPosition(3, 1f))
                .select(0, 0)

        assertEquals("Y1/a.pdf", layout.selectedTab?.path)
        assertEquals(
            TabPosition(3, 1f),
            layout.panes
                .single()
                .tabs[1]
                .position,
        )
    }

    @Test
    fun `closing the selected Tab selects the one that took its place`() {
        val layout = opened("a.pdf", "b.pdf", "c.pdf").select(0, 1).close(0, 1)

        assertEquals(listOf("a.pdf", "c.pdf"), layout.paths())
        assertEquals("c.pdf", layout.selectedTab?.path)
    }

    @Test
    fun `closing the selected last Tab selects the one before it`() {
        val layout = opened("a.pdf", "b.pdf", "c.pdf").close(0, 2)

        assertEquals("b.pdf", layout.selectedTab?.path)
    }

    @Test
    fun `closing a Tab before the selected one keeps the selection`() {
        val layout = opened("a.pdf", "b.pdf", "c.pdf").close(0, 0)

        assertEquals("c.pdf", layout.selectedTab?.path)
    }

    @Test
    fun `closing the last Tab closes the Pane, leaving an empty Layout`() {
        assertEquals(Layout(), opened("a.pdf").close(0, 0))
    }

    @Test
    fun `selecting or closing a Tab that isn't there changes nothing`() {
        val layout = opened("a.pdf")

        assertEquals(layout, layout.select(0, 3))
        assertEquals(layout, layout.close(1, 0))
        assertEquals(layout, layout.moved(0, -1, start))
    }
}
