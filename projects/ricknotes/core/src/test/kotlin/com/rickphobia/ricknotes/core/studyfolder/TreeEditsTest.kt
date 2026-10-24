package com.rickphobia.ricknotes.core.studyfolder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path

class TreeEditsTest {
    @get:Rule
    val temp = TemporaryFolder()

    private fun write(
        relative: String,
        text: String = relative,
    ) = File(temp.root, relative).apply {
        parentFile.mkdirs()
        writeText(text)
    }

    private fun folder(relative: String) = File(temp.root, relative).apply { mkdirs() }

    /** Every file under the Study folder with its text, so a test sees all that moved and all that didn't. */
    private fun files(): Map<String, String> =
        temp.root
            .walkTopDown()
            .filter { it.isFile }
            .associate { it.relativeTo(temp.root).invariantSeparatorsPath to it.readText() }

    private fun edits(
        move: FileMover = { from, to -> Files.move(from, to) },
        stillSaving: (Path) -> Boolean = { false },
    ) = TreeEdits(temp.root.toPath(), stillSaving, move)

    // A Document with ink, a Picture and two Versions, plus another Document's Version beside them.
    private fun documentWithCompanions(folder: String) {
        write("$folder/tuto3.pdf", "pdf")
        write("$folder/tuto3.pdf.ink.json", "ink")
        write("$folder/tuto3.pdf.assets/picture-1.png", "picture")
        write("$folder/.versions/tuto3.pdf.ink.json.1000.version", "v1")
        write("$folder/.versions/tuto3.pdf.ink.json.2000.version", "v2")
        write("$folder/.versions/tuto3.pdf.ink.json.notes.version", "not a Version")
        write("$folder/.versions/other.pdf.ink.json.1000.version", "other")
    }

    @Test
    fun `renaming a Document carries its Ink file, Pictures and Versions`() {
        documentWithCompanions("EE2001")

        val renamed = edits().renameDocument("EE2001/tuto3.pdf", "Tutorial 3")

        assertEquals("EE2001/Tutorial 3.pdf", renamed)
        assertEquals(
            mapOf(
                "EE2001/Tutorial 3.pdf" to "pdf",
                "EE2001/Tutorial 3.pdf.ink.json" to "ink",
                "EE2001/Tutorial 3.pdf.assets/picture-1.png" to "picture",
                "EE2001/.versions/Tutorial 3.pdf.ink.json.1000.version" to "v1",
                "EE2001/.versions/Tutorial 3.pdf.ink.json.2000.version" to "v2",
                "EE2001/.versions/tuto3.pdf.ink.json.notes.version" to "not a Version",
                "EE2001/.versions/other.pdf.ink.json.1000.version" to "other",
            ),
            files(),
        )
    }

    @Test
    fun `moving a Document to another course carries every companion into it`() {
        documentWithCompanions("EE2001")
        folder("EE2002")

        val moved = edits().moveDocument("EE2001/tuto3.pdf", "EE2002")

        assertEquals("EE2002/tuto3.pdf", moved)
        assertEquals(
            mapOf(
                "EE2002/tuto3.pdf" to "pdf",
                "EE2002/tuto3.pdf.ink.json" to "ink",
                "EE2002/tuto3.pdf.assets/picture-1.png" to "picture",
                "EE2002/.versions/tuto3.pdf.ink.json.1000.version" to "v1",
                "EE2002/.versions/tuto3.pdf.ink.json.2000.version" to "v2",
                "EE2001/.versions/tuto3.pdf.ink.json.notes.version" to "not a Version",
                "EE2001/.versions/other.pdf.ink.json.1000.version" to "other",
            ),
            files(),
        )
    }

    @Test
    fun `a Document with no ink yet renames on its own`() {
        write("a.pdf", "pdf")

        edits().renameDocument("a.pdf", "b.pdf")

        assertEquals(mapOf("b.pdf" to "pdf"), files())
    }

    @Test
    fun `a clash on the PDF refuses with nothing moved`() {
        documentWithCompanions("EE2001")
        write("EE2002/tuto3.pdf", "someone else's")
        val before = files()

        val error = assertThrows(TreeEditRefused::class.java) { edits().moveDocument("EE2001/tuto3.pdf", "EE2002") }

        assertEquals("tuto3.pdf already exists", error.message)
        assertEquals(before, files())
    }

    @Test
    fun `a clash on any companion refuses with nothing moved`() {
        for (companion in listOf("b.pdf.ink.json", "b.pdf.assets/x.png", ".versions/b.pdf.ink.json.2000.version")) {
            temp.root.listFiles()!!.forEach { it.deleteRecursively() }
            documentWithCompanions("")
            write(companion, "left behind")
            val before = files()

            assertThrows(companion, TreeEditRefused::class.java) { edits().renameDocument("tuto3.pdf", "b") }

            assertEquals(companion, before, files())
        }
    }

    @Test
    fun `a failure halfway moves everything back and names the file`() {
        documentWithCompanions("EE2001")
        folder("EE2002")
        val before = files()
        val failingOnThePdf: FileMover = { from, to ->
            if (from.fileName.toString() == "tuto3.pdf") throw IOException("disk said no")
            Files.move(from, to)
        }

        val error =
            assertThrows(TreeEditFailed::class.java) {
                edits(failingOnThePdf).moveDocument("EE2001/tuto3.pdf", "EE2002")
            }

        assertEquals("tuto3.pdf", error.fileName)
        assertEquals(emptyList<String>(), error.notMovedBack)
        // File names only: it is shown and logged.
        assertEquals("failed at tuto3.pdf (IOException)", error.message)
        assertEquals(before, files())
    }

    @Test
    fun `a file that can't be moved back is named in the error`() {
        documentWithCompanions("")
        var moves = 0
        val failingAfterTheInk: FileMover = { from, to ->
            moves++
            if (moves > 1) throw IOException("disk said no")
            Files.move(from, to)
        }

        val error =
            assertThrows(TreeEditFailed::class.java) { edits(failingAfterTheInk).renameDocument("tuto3.pdf", "b") }

        assertEquals("tuto3.pdf.assets", error.fileName)
        assertEquals(listOf("b.pdf.ink.json"), error.notMovedBack)
    }

    @Test
    fun `a Document name gets pdf added, and a hidden or path-like name is refused`() {
        write("a.pdf")

        assertEquals("b.PDF", edits().renameDocument("a.pdf", " b.PDF "))
        for (name in listOf("", "  ", ".pdf", ".hidden", "x/y", "x\\y")) {
            assertThrows(name, TreeEditRefused::class.java) { edits().renameDocument("b.PDF", name) }
        }
        assertEquals(setOf("b.PDF"), files().keys)
    }

    @Test
    fun `renaming a Document to its own name is refused`() {
        write("a.pdf")

        assertThrows(TreeEditRefused::class.java) { edits().renameDocument("a.pdf", "a") }
        assertThrows(TreeEditRefused::class.java) { edits().moveDocument("a.pdf", "") }
    }

    @Test
    fun `a gone Document or folder is refused`() {
        folder("Y1")

        assertThrows(TreeEditRefused::class.java) { edits().renameDocument("a.pdf", "b") }
        assertThrows(TreeEditRefused::class.java) { edits().moveDocument("Y1/a.pdf", "") }
        assertThrows(TreeEditRefused::class.java) { edits().renameFolder("Y2", "Y3") }
        assertThrows(TreeEditRefused::class.java) { edits().newFolder("Y2", "Sem1") }
    }

    @Test
    fun `new folder makes an empty folder, and refuses a taken name`() {
        folder("Y1/Sem1")

        assertEquals("Y1/Sem2", edits().newFolder("Y1", "Sem2"))
        assertEquals("Y2", edits().newFolder("", "Y2"))
        assertTrue(File(temp.root, "Y1/Sem2").isDirectory)
        assertTrue(File(temp.root, "Y2").isDirectory)
        assertThrows(TreeEditRefused::class.java) { edits().newFolder("Y1", "Sem1") }
    }

    @Test
    fun `a folder name the tree would hide is refused`() {
        for (name in listOf("_revision_log", "_ricknotes", "notes.assets", ".versions", "a/b")) {
            assertThrows(name, TreeEditRefused::class.java) { edits().newFolder("", name) }
        }
        assertEquals(emptyList<String>(), temp.root.list()!!.toList())
    }

    @Test
    fun `renaming a folder carries everything inside it`() {
        documentWithCompanions("Y1/Sem1/EE2001")
        write("Y1/Sem1/EE2001/_revision_log/revision_log.json", "log")
        val before = files()

        assertEquals("Y1/Sem1/EE2002", edits().renameFolder("Y1/Sem1/EE2001", "EE2002"))

        assertEquals(before.mapKeys { it.key.replace("EE2001", "EE2002") }, files())
    }

    @Test
    fun `moving a folder puts it inside the target`() {
        documentWithCompanions("Y1/Sem1/EE2001")
        folder("Y1/Sem2")
        val before = files()

        assertEquals("Y1/Sem2/EE2001", edits().moveFolder("Y1/Sem1/EE2001", "Y1/Sem2"))

        assertEquals(before.mapKeys { it.key.replace("Sem1", "Sem2") }, files())
    }

    @Test
    fun `moving a folder into itself or below it is refused`() {
        folder("Y1/Sem1/EE2001")

        assertThrows(TreeEditRefused::class.java) { edits().moveFolder("Y1", "Y1") }
        assertThrows(TreeEditRefused::class.java) { edits().moveFolder("Y1", "Y1/Sem1/EE2001") }
        assertTrue(File(temp.root, "Y1/Sem1/EE2001").isDirectory)
    }

    @Test
    fun `a folder whose name only starts the same is not inside it`() {
        folder("Y1")
        folder("Y10")

        assertEquals("Y10/Y1", edits().moveFolder("Y1", "Y10"))
    }

    @Test
    fun `a folder clash refuses, and the Study folder itself can't move`() {
        write("Y1/a.pdf")
        write("Y2/Y1/b.pdf")
        val before = files()

        assertThrows(TreeEditRefused::class.java) { edits().moveFolder("Y1", "Y2") }
        assertThrows(TreeEditRefused::class.java) { edits().renameFolder("Y1", "Y2") }
        assertThrows(TreeEditRefused::class.java) { edits().renameFolder("", "Y3") }
        assertEquals(before, files())
    }

    @Test
    fun `a Document whose ink is still being saved can't be renamed or moved, alone or in its folder`() {
        documentWithCompanions("Y1/EE2001")
        folder("Y2")
        val before = files()
        val saving = { pdf: Path -> pdf.fileName.toString() == "tuto3.pdf" }

        val error =
            assertThrows(
                TreeEditRefused::class.java,
            ) { edits(stillSaving = saving).renameDocument("Y1/EE2001/tuto3.pdf", "b") }
        assertThrows(
            TreeEditRefused::class.java,
        ) { edits(stillSaving = saving).moveDocument("Y1/EE2001/tuto3.pdf", "Y2") }
        assertThrows(TreeEditRefused::class.java) { edits(stillSaving = saving).moveFolder("Y1", "Y2") }
        assertThrows(TreeEditRefused::class.java) { edits(stillSaving = saving).renameFolder("Y1/EE2001", "EE2002") }

        assertEquals("the ink of tuto3.pdf is still being saved; try again in a moment", error.message)
        assertEquals(before, files())
    }

    @Test
    fun `any other I-O error comes as a failure naming the file`() {
        documentWithCompanions("")
        val versions = File(temp.root, ".versions")
        // Unlistable, so listing the Versions to carry fails before anything moves.
        versions.setReadable(false)
        try {
            val error = assertThrows(TreeEditFailed::class.java) { edits().renameDocument("tuto3.pdf", "b") }

            assertEquals("tuto3.pdf", error.fileName)
        } finally {
            versions.setReadable(true)
        }
        assertTrue(File(temp.root, "tuto3.pdf").isFile)
    }

    @Test
    fun `a renamed path follows a Document and everything in a folder`() {
        assertEquals("b.pdf", renamedPath("a.pdf", "a.pdf", "b.pdf"))
        assertEquals("Y2/Sem1/a.pdf", renamedPath("Y1/Sem1/a.pdf", "Y1", "Y2"))
        assertEquals(null, renamedPath("Y10/a.pdf", "Y1", "Y2"))
        assertEquals(null, renamedPath("other.pdf", "a.pdf", "b.pdf"))
    }

    @Test
    fun `linking Orphaned ink to a PDF renames every companion to match it`() {
        documentWithCompanions("EE2001")
        File(temp.root, "EE2001/tuto3.pdf").renameTo(File(temp.root, "EE2001/Tutorial 3.pdf"))

        val linked = edits().linkOrphanedInk("EE2001/tuto3.pdf", "EE2001/Tutorial 3.pdf")

        assertEquals("EE2001/Tutorial 3.pdf", linked)
        assertEquals(
            mapOf(
                "EE2001/Tutorial 3.pdf" to "pdf",
                "EE2001/Tutorial 3.pdf.ink.json" to "ink",
                "EE2001/Tutorial 3.pdf.assets/picture-1.png" to "picture",
                "EE2001/.versions/Tutorial 3.pdf.ink.json.1000.version" to "v1",
                "EE2001/.versions/Tutorial 3.pdf.ink.json.2000.version" to "v2",
                "EE2001/.versions/tuto3.pdf.ink.json.notes.version" to "not a Version",
                "EE2001/.versions/other.pdf.ink.json.1000.version" to "other",
            ),
            files(),
        )
    }

    @Test
    fun `linking refuses on a clash with nothing moved`() {
        write("old.pdf.ink.json", "ink")
        write("old.pdf.assets/picture-1.png", "picture")
        write("new.pdf", "pdf")
        write("new.pdf.assets/picture-1.png", "someone else's picture")
        val before = files()

        val error = assertThrows(TreeEditRefused::class.java) { edits().linkOrphanedInk("old.pdf", "new.pdf") }

        assertEquals("new.pdf.assets already exists", error.message)
        assertEquals(before, files())
    }

    @Test
    fun `linking refuses a PDF with ink, in another folder, or ink that has its PDF`() {
        write("Y1/old.pdf.ink.json", "ink")
        write("Y1/inked.pdf", "pdf")
        write("Y1/inked.pdf.ink.json", "other ink")
        write("Y2/new.pdf", "pdf")
        write("Y1/whole.pdf", "pdf")
        write("Y1/whole.pdf.ink.json", "ink")
        val before = files()

        fun refusal(
            orphan: String,
            pdf: String,
        ) = assertThrows(TreeEditRefused::class.java) { edits().linkOrphanedInk(orphan, pdf) }.message

        assertEquals("inked.pdf already has ink", refusal("Y1/old.pdf", "Y1/inked.pdf"))
        assertEquals("new.pdf isn't in the same folder as the ink", refusal("Y1/old.pdf", "Y2/new.pdf"))
        assertEquals("whole.pdf has its PDF", refusal("Y1/whole.pdf", "Y1/inked.pdf"))
        assertEquals("the ink of gone.pdf is gone", refusal("Y1/gone.pdf", "Y1/inked.pdf"))
        assertEquals(before, files())
    }
}
