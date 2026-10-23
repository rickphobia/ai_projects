package com.rickphobia.ricknotes.core.studyfolder

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class PdfImportTest {
    @get:Rule
    val temp = TemporaryFolder()

    private val tutorial by lazy { File(temp.root, "Study/EE2001/tutorial").apply { mkdirs() } }
    private val source by lazy {
        File(temp.root, "Download/tuto3.pdf").apply {
            parentFile.mkdirs()
            writeBytes(byteArrayOf(1, 2, 3))
        }
    }

    private fun copy(name: String = "tuto3.pdf") = copyPdfInto(tutorial.toPath(), source.toPath(), name)

    @Test
    fun `copies the PDF in under its own name when it is free`() {
        val copied = copy()

        assertEquals(File(tutorial, "tuto3.pdf").toPath(), copied.path)
        assertFalse(copied.nameClashed)
        assertArrayEquals(byteArrayOf(1, 2, 3), copied.path.toFile().readBytes())
    }

    @Test
    fun `a taken name becomes (2), then (3), never overwriting`() {
        File(tutorial, "tuto3.pdf").writeBytes(byteArrayOf(9))

        val second = copy()
        val third = copy()

        assertEquals("tuto3 (2).pdf", second.path.fileName.toString())
        assertEquals("tuto3 (3).pdf", third.path.fileName.toString())
        assertTrue(second.nameClashed)
        assertTrue(third.nameClashed)
        assertArrayEquals(byteArrayOf(9), File(tutorial, "tuto3.pdf").readBytes())
        assertArrayEquals(byteArrayOf(1, 2, 3), second.path.toFile().readBytes())
        assertArrayEquals(byteArrayOf(1, 2, 3), third.path.toFile().readBytes())
    }

    @Test
    fun `the source is left where it was, unchanged`() {
        copy()
        copy()

        assertTrue(source.exists())
        assertArrayEquals(byteArrayOf(1, 2, 3), source.readBytes())
    }

    @Test
    fun `a name without a pdf extension gets one, and folders in the name are dropped`() {
        assertEquals("notes.pdf", copy("notes").path.fileName.toString())
        val nested = copy("../x/lec1.PDF")
        assertEquals("lec1.PDF", nested.path.fileName.toString())
        assertEquals(tutorial.toPath(), nested.path.parent)
    }

    @Test
    fun `a blank or hidden name falls back to a plain one`() {
        assertEquals("Document.pdf", copy("").path.fileName.toString())
        assertEquals("Document (2).pdf", copy(".hidden.pdf").path.fileName.toString())
    }

    @Test
    fun `leaves no temporary file behind`() {
        copy()

        assertEquals(listOf("tuto3.pdf"), tutorial.list()!!.toList())
    }

    @Test
    fun `a missing folder is a PdfNotCopied`() {
        val error =
            assertThrows(PdfNotCopied::class.java) {
                copyPdfInto(File(temp.root, "nowhere").toPath(), source.toPath(), "tuto3.pdf")
            }
        assertEquals("nowhere", error.folderName)
    }
}
