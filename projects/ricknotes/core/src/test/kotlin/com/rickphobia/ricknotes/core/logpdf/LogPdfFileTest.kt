package com.rickphobia.ricknotes.core.logpdf

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path

class LogPdfFileTest {
    @get:Rule
    val folder = TemporaryFolder()

    private fun course(): Path = Files.createDirectories(folder.root.toPath().resolve("Y1/Sem1/EE2001"))

    // Every file in [course], hidden temporary files included.
    private fun namesIn(course: Path): List<String> =
        Files.list(course).use { files -> files.map { it.fileName.toString() }.toList() }

    @Test
    fun `the PDF is named after the course and goes in the Course folder`() {
        val course = course()

        val written = LogPdfFile.write(course) { it.write(byteArrayOf(1, 2, 3)) }

        assertEquals(course.resolve("EE2001 revision log.pdf"), written)
        assertArrayEquals(byteArrayOf(1, 2, 3), Files.readAllBytes(written))
    }

    @Test
    fun `a new export replaces the last one`() {
        val course = course()
        LogPdfFile.write(course) { it.write(byteArrayOf(1, 2, 3)) }

        val written = LogPdfFile.write(course) { it.write(byteArrayOf(4)) }

        assertArrayEquals(byteArrayOf(4), Files.readAllBytes(written))
        assertEquals(listOf("EE2001 revision log.pdf"), namesIn(course))
    }

    @Test
    fun `a failed write leaves the old export whole and no temporary file`() {
        val course = course()
        LogPdfFile.write(course) { it.write(byteArrayOf(1, 2, 3)) }

        val error =
            assertThrows(LogPdfWriteFailed::class.java) {
                LogPdfFile.write(course) {
                    it.write(byteArrayOf(9, 9))
                    throw IOException("disk full")
                }
            }

        assertEquals("EE2001 revision log.pdf", error.fileName)
        assertArrayEquals(byteArrayOf(1, 2, 3), Files.readAllBytes(LogPdfFile.of(course)))
        assertEquals(listOf("EE2001 revision log.pdf"), namesIn(course))
    }
}
