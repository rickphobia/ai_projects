package com.rickphobia.ricknotes.core.layout

import org.junit.Assert.assertEquals
import org.junit.Test

class RenamingTest {
    private val start = TabPosition(pageIndex = 0, zoom = 1f)

    @Test
    fun `every Tab of a renamed Document follows it with its page and zoom`() {
        val layout =
            Layout()
                .open("Y1/a.pdf", TabPosition(5, 2f))
                .open("Y1/b.pdf", start)
                .split()
                .open("Y1/a.pdf", TabPosition(7, 1f))

        val renamed = layout.renamed("Y1/a.pdf", "Y2/c.pdf")

        assertEquals(listOf(Tab("Y2/c.pdf", TabPosition(5, 2f)), Tab("Y1/b.pdf", start)), renamed.panes[0].tabs)
        assertEquals(listOf(Tab("Y1/b.pdf", start), Tab("Y2/c.pdf", TabPosition(7, 1f))), renamed.panes[1].tabs)
        assertEquals(layout.focused, renamed.focused)
        assertEquals(layout.panes.map { it.selected }, renamed.panes.map { it.selected })
    }

    @Test
    fun `Tabs of Documents inside a renamed folder follow it, and no others`() {
        val layout = Layout().open("Y1/Sem1/a.pdf", start).open("Y10/b.pdf", start).open("Y1.pdf", start)

        val renamed = layout.renamed("Y1", "Y2")

        assertEquals(
            listOf("Y2/Sem1/a.pdf", "Y10/b.pdf", "Y1.pdf"),
            renamed.panes
                .single()
                .tabs
                .map { it.path },
        )
    }

    @Test
    fun `a missing Tab that is renamed in the app is found again`() {
        val layout = Layout().open("a.pdf", start).checkMissing { false }

        assertEquals(Tab("b.pdf", start), layout.renamed("a.pdf", "b.pdf").selectedTab)
    }

    @Test
    fun `an empty Layout stays empty`() {
        assertEquals(Layout(), Layout().renamed("a.pdf", "b.pdf"))
    }
}
