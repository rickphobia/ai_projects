package com.rickphobia.ricknotes.core.layout

import com.rickphobia.ricknotes.core.layout.LayoutLoader.LAYOUT_KEY
import com.rickphobia.ricknotes.core.settings.SettingsSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private const val PANE = """{"tabs":[{"path":"a.pdf","page":0,"zoom":1}],"selected":0}"""

class LayoutLoaderTest {
    private val warnings = mutableListOf<String>()

    private fun restored(stored: String?) = LayoutLoader.restore(SettingsSource { stored }, warnings::add)

    @Test
    fun `nothing stored restores an empty Layout without a warning`() {
        assertEquals(Layout(), restored(null))
        assertTrue(warnings.isEmpty())
    }

    @Test
    fun `a saved Layout comes back with every Tab, its position and the selection`() {
        val layout =
            Layout()
                .open("Y1/Sem1/EE2001/Lecture 1.pdf", TabPosition(5, 2.5f))
                .open("Notes, misc/b \"quoted\".pdf", TabPosition(0, 1f))
                .select(0, 0)
        val saved = mutableMapOf<String, String>()

        LayoutLoader.save({ key, value -> saved[key] = value }, layout)

        assertEquals(layout, LayoutLoader.restore({ saved[it] }, warnings::add))
        assertTrue(warnings.isEmpty())
    }

    @Test
    fun `two Panes come back with their Tabs and the Focused Pane`() {
        val layout =
            Layout()
                .open("a.pdf", TabPosition(5, 2.5f))
                .split()
                .open("b.pdf", TabPosition(1, 1f))
                .focus(0)
        val saved = mutableMapOf<String, String>()

        LayoutLoader.save({ key, value -> saved[key] = value }, layout)

        assertEquals(layout, LayoutLoader.restore({ saved[it] }, warnings::add))
        assertTrue(warnings.isEmpty())
    }

    @Test
    fun `a Layout saved before the Focused Pane was kept focuses the first Pane`() {
        val layout = restored("""{"panes":[{"tabs":[{"path":"a.pdf","page":2,"zoom":1}],"selected":0}]}""")

        assertEquals(0, layout.focused)
        assertEquals("a.pdf", layout.selectedTab?.path)
    }

    @Test
    fun `an empty Layout round-trips`() {
        val saved = mutableMapOf<String, String>()

        LayoutLoader.save({ key, value -> saved[key] = value }, Layout())

        assertEquals(Layout(), LayoutLoader.restore({ saved[it] }, warnings::add))
    }

    @Test
    fun `a damaged Layout starts empty with a warning`() {
        val damaged =
            listOf(
                "not json",
                """{"panes":[{"tabs":[],"selected":0}]}""",
                """{"panes":[{"tabs":[{"path":"a.pdf","page":0,"zoom":1}],"selected":1}]}""",
                """{"panes":[{"tabs":[{"path":"a.pdf","page":-1,"zoom":1}],"selected":0}]}""",
                """{"panes":[{"tabs":[{"path":"","page":0,"zoom":1}],"selected":0}]}""",
                """{"panes":[{"tabs":[{"path":"a.pdf","page":0,"zoom":1}],"selected":0}],"focused":1}""",
                """{"panes":[$PANE,$PANE,$PANE]}""",
            )
        damaged.forEach { text ->
            warnings.clear()

            assertEquals(text, Layout(), restored(text))
            assertEquals(text, 1, warnings.size)
        }
    }

    @Test
    fun `the warning names the problem but not the stored paths`() {
        restored("""{"panes":[{"tabs":[{"path":"Secret/a.pdf","page":-1,"zoom":1}],"selected":0}]}""")

        assertFalse(warnings.single(), warnings.single().contains("Secret"))
        assertTrue(warnings.single(), warnings.single().contains(LAYOUT_KEY))
    }

    @Test
    fun `the divider comes back where it was`() {
        val layout =
            Layout()
                .open("a.pdf", TabPosition(0, 1f))
                .split()
                .setDivider(0.35f)
        val saved = mutableMapOf<String, String>()

        LayoutLoader.save({ key, value -> saved[key] = value }, layout)

        assertEquals(0.35f, LayoutLoader.restore({ saved[it] }, warnings::add).divider)
        assertTrue(warnings.isEmpty())
    }

    @Test
    fun `a Layout saved before the divider moved has equal Panes`() {
        assertEquals(EQUAL_PANES, restored("""{"panes":[$PANE,$PANE]}""").divider)
        assertTrue(warnings.isEmpty())
    }

    @Test
    fun `a divider past either Pane's minimum starts empty with a warning`() {
        assertEquals(Layout(), restored("""{"panes":[$PANE],"divider":0.01}"""))
        assertEquals(1, warnings.size)
    }
}
