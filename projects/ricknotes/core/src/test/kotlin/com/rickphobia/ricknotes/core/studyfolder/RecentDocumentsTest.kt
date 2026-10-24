package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore
import org.junit.Assert.assertEquals
import org.junit.Test

class RecentDocumentsTest {
    private class MapSettings :
        SettingsSource,
        SettingsStore {
        val stored = mutableMapOf<String, String>()

        override fun read(key: String): String? = stored[key]

        override fun write(
            key: String,
            value: String,
        ) {
            stored[key] = value
        }
    }

    private val settings = MapSettings()

    private fun recent() = RecentDocuments(settings)

    @Test
    fun `nothing opened yet means no Recent Documents`() {
        assertEquals(emptyList<String>(), recent().paths())
    }

    @Test
    fun `the Document opened last comes first`() {
        recent().opened("Y1/Sem1/a.pdf")
        recent().opened("Y1/Sem1/b.pdf")

        assertEquals(listOf("Y1/Sem1/b.pdf", "Y1/Sem1/a.pdf"), recent().paths())
    }

    @Test
    fun `opening a Document again moves it to the front without a second copy`() {
        recent().opened("a.pdf")
        recent().opened("b.pdf")
        recent().opened("c.pdf")

        recent().opened("a.pdf")

        assertEquals(listOf("a.pdf", "c.pdf", "b.pdf"), recent().paths())
    }

    @Test
    fun `only the last 8 are kept`() {
        (1..10).forEach { recent().opened("doc$it.pdf") }

        assertEquals((10 downTo 3).map { "doc$it.pdf" }, recent().paths())
    }

    @Test
    fun `paths with commas and spaces survive being stored`() {
        recent().opened("Y1/Sem 1/Week 2, part 1.pdf")

        assertEquals(listOf("Y1/Sem 1/Week 2, part 1.pdf"), recent().paths())
    }

    @Test
    fun `a stored list with blanks or repeats is cleaned up on load`() {
        settings.stored[RecentDocuments.KEY] = "a.pdf\n\nb.pdf\na.pdf"

        assertEquals(listOf("a.pdf", "b.pdf"), recent().paths())
    }

    @Test
    fun `a renamed Document keeps its place in the row`() {
        listOf("a.pdf", "Y1/b.pdf", "c.pdf").forEach { recent().opened(it) }

        recent().renamed("Y1/b.pdf", "Y2/d.pdf")

        assertEquals(listOf("c.pdf", "Y2/d.pdf", "a.pdf"), recent().paths())
    }

    @Test
    fun `Documents inside a renamed folder follow it, and no others`() {
        listOf("Y1/Sem1/a.pdf", "Y10/b.pdf").forEach { recent().opened(it) }

        recent().renamed("Y1", "Y2")

        assertEquals(listOf("Y10/b.pdf", "Y2/Sem1/a.pdf"), recent().paths())
    }

    @Test
    fun `a rename that touches no Recent Document writes nothing`() {
        recent().renamed("a.pdf", "b.pdf")

        assertEquals(emptyMap<String, String>(), settings.stored)
    }
}
