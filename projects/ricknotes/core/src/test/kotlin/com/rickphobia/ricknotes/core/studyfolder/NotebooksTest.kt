package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.inkfile.InkFileCodec
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.time.LocalDate

class NotebooksTest {
    @get:Rule
    val temp = TemporaryFolder()

    private val today = LocalDate.of(2026, 10, 24)
    private val study by lazy { File(temp.root, "Study").apply { mkdirs() } }
    private val scratch by lazy { temp.newFolder("scratch").toPath() }
    private val written = mutableListOf<PageBackground>()
    private val notebooks by lazy {
        Notebooks(study.toPath(), scratch) { background, to ->
            written += background
            Files.write(to, byteArrayOf(7))
        }
    }

    private fun folder(path: String) = File(study, path).apply { mkdirs() }

    @Test
    fun `a Notebook goes in the long-pressed folder, named for the day`() {
        folder("Y1/misc")

        val path = notebooks.create("Y1/misc", CourseFolders(), PageBackground.DOTTED, today)

        assertEquals("Y1/misc/Notes 2026-10-24.pdf", path)
        assertArrayEquals(byteArrayOf(7), File(study, path).readBytes())
        assertEquals(listOf(PageBackground.DOTTED), written)
    }

    @Test
    fun `its Ink file records the background on one PDF page`() {
        folder("Y1")

        val path = notebooks.create("Y1", CourseFolders(), PageBackground.GRID, today)

        val ink = InkFileCodec.decode(File(study, "$path.ink.json").readText(), "ink")
        assertEquals(PageBackground.GRID, ink.notebook)
        assertEquals(1, ink.pdfPageCount)
        assertEquals(1, ink.pages.size)
        assertFalse(ink.pages.single().inserted)
    }

    @Test
    fun `a Course folder with a pnotes folder gets it there`() {
        folder("Y1/Sem1/EE2001/pnotes")

        val path = notebooks.create("Y1/Sem1/EE2001", CourseFolders(), PageBackground.LINED, today)

        assertEquals("Y1/Sem1/EE2001/pnotes/Notes 2026-10-24.pdf", path)
    }

    @Test
    fun `a Course folder without pnotes gets it in the folder itself`() {
        folder("Y1/Sem1/EE2001")

        val path = notebooks.create("Y1/Sem1/EE2001", CourseFolders(), PageBackground.LINED, today)

        assertEquals("Y1/Sem1/EE2001/Notes 2026-10-24.pdf", path)
    }

    @Test
    fun `pnotes is only used in a Course folder`() {
        folder("Y1/Sem1/pnotes")

        val path = notebooks.create("Y1/Sem1", CourseFolders(), PageBackground.BLANK, today)

        assertEquals("Y1/Sem1/Notes 2026-10-24.pdf", path)
    }

    @Test
    fun `a taken name becomes (2), then (3), never overwriting`() {
        val misc = folder("misc")
        File(misc, "Notes 2026-10-24.pdf").writeBytes(byteArrayOf(1))

        val second = notebooks.create("misc", CourseFolders(), PageBackground.BLANK, today)
        val third = notebooks.create("misc", CourseFolders(), PageBackground.BLANK, today)

        assertEquals("misc/Notes 2026-10-24 (2).pdf", second)
        assertEquals("misc/Notes 2026-10-24 (3).pdf", third)
        assertArrayEquals(byteArrayOf(1), File(misc, "Notes 2026-10-24.pdf").readBytes())
    }

    @Test
    fun `a failed PDF write adds nothing and leaves no scratch file`() {
        folder("misc")
        val failing = Notebooks(study.toPath(), scratch) { _, _ -> throw IOException("disk full") }

        val error =
            assertThrows(NotebookNotCreated::class.java) {
                failing.create("misc", CourseFolders(), PageBackground.BLANK, today)
            }

        assertFalse(error.pdfMade)
        assertTrue(File(study, "misc").list().isNullOrEmpty())
        assertTrue(scratch.toFile().list().isNullOrEmpty())
    }

    @Test
    fun `a missing folder is refused with nothing made`() {
        assertThrows(NotebookNotCreated::class.java) {
            notebooks.create("gone", CourseFolders(), PageBackground.BLANK, today)
        }
        assertFalse(File(study, "gone").exists())
    }
}
