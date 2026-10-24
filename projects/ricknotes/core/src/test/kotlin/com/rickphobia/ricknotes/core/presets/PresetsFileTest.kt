package com.rickphobia.ricknotes.core.presets

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class PresetsFileTest {
    @get:Rule
    val temp = TemporaryFolder()

    private val file: File get() = File(temp.root, "_ricknotes/presets.json")

    private fun load() = PresetsFile(temp.root.toPath()).load()

    private fun writeFile(text: String) {
        file.parentFile.mkdirs()
        file.writeText(text)
    }

    @Test
    fun `a missing file is written with the Default Presets and they are used`() {
        val loaded = load()

        assertEquals(DEFAULT_PRESETS, loaded.presets)
        assertNull(loaded.problem)
        assertTrue(file.isFile)
        assertEquals(DEFAULT_PRESETS, load().presets)
    }

    @Test
    fun `the Default Presets are the four from the spec, ink on for the tutorial ones`() {
        assertEquals(
            listOf("Chapter overview" to false, "Answer only" to true, "Hint" to true, "Full explanation" to true),
            DEFAULT_PRESETS.map { it.name to it.inkOn },
        )
    }

    @Test
    fun `an existing file is used and never overwritten`() {
        val mine = """{"presets":[{"name":"Mine","prompt":"Do it my way","inkOn":false}]}"""
        writeFile(mine)

        val loaded = load()

        assertEquals(listOf(Preset("Mine", "Do it my way", inkOn = false)), loaded.presets)
        assertNull(loaded.problem)
        assertEquals(mine, file.readText())
    }

    @Test
    fun `a broken file falls back to the defaults, says why and is left as it was`() {
        writeFile("{not json")

        val loaded = load()

        assertEquals(DEFAULT_PRESETS, loaded.presets)
        assertTrue(loaded.problem.orEmpty().contains("not valid Presets JSON"))
        assertEquals("{not json", file.readText())
    }

    @Test
    fun `a file with no Presets, a blank prompt or a repeated name is broken`() {
        listOf(
            """{"presets":[]}""" to "no Presets",
            """{"presets":[{"name":"A","prompt":" ","inkOn":false}]}""" to "'A' has no prompt",
            """{"presets":[{"name":" ","prompt":"p","inkOn":false}]}""" to "a Preset has no name",
            """{"presets":[{"name":"A","prompt":"p"},{"name":"A","prompt":"q","inkOn":true}]}""" to
                "'A' is named twice",
        ).forEach { (json, reason) ->
            writeFile(json)
            val loaded = load()
            assertEquals(DEFAULT_PRESETS, loaded.presets)
            assertTrue("$json: ${loaded.problem}", loaded.problem.orEmpty().contains(reason))
        }
    }

    @Test
    fun `ink on is optional and off when left out`() {
        writeFile("""{"presets":[{"name":"A","prompt":"p"}]}""")

        assertEquals(listOf(Preset("A", "p", inkOn = false)), load().presets)
    }

    @Test
    fun `a Study folder that can't be written still gets the defaults, with the reason`() {
        // A file where the _ricknotes folder should be makes the write fail.
        File(temp.root, "_ricknotes").writeText("")

        val loaded = load()

        assertEquals(DEFAULT_PRESETS, loaded.presets)
        assertNotNull(loaded.problem)
    }
}
