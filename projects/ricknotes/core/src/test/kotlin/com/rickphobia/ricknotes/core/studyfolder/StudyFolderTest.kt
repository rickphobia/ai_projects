package com.rickphobia.ricknotes.core.studyfolder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class StudyFolderTest {
    @get:Rule
    val temp = TemporaryFolder()

    private fun touch(relative: String) =
        File(temp.root, relative).apply {
            parentFile.mkdirs()
            writeText("")
        }

    private fun folder(relative: String) = File(temp.root, relative).apply { mkdirs() }

    /** The tree as indented lines, folders ending in "/", so a failure shows the whole shape. */
    private fun outline(
        node: TreeNode,
        depth: Int = 0,
    ): List<String> =
        when (node) {
            is TreeNode.Document -> {
                listOf("  ".repeat(depth) + node.name)
            }

            is TreeNode.Folder -> {
                listOf("  ".repeat(depth) + node.name + "/") + node.children.flatMap { outline(it, depth + 1) }
            }

            is TreeNode.OrphanedInk -> {
                listOf("  ".repeat(depth) + node.name + " (orphaned ink)")
            }
        }

    private fun listed() =
        StudyFolder(temp.root.toPath())
            .listTree { folder, error -> throw AssertionError("unexpected unreadable $folder", error) }
            .children
            .flatMap { outline(it) }

    @Test
    fun `lists folders before PDFs, each sorted by name ignoring case`() {
        touch("Y1/Sem1/EE2001/tuto/tuto3.pdf")
        touch("Y1/Sem1/EE2001/Lec1.PDF")
        touch("Y1/Sem1/EE2001/a.pdf")
        folder("Y1/Sem2")
        touch("readme.pdf")

        assertEquals(
            listOf(
                "Y1/",
                "  Sem1/",
                "    EE2001/",
                "      tuto/",
                "        tuto3.pdf",
                "      a.pdf",
                "      Lec1.PDF",
                "  Sem2/",
                "readme.pdf",
            ),
            listed(),
        )
    }

    @Test
    fun `hides Ink files, assets, Versions, Revision logs, temporary and other files`() {
        touch("EE2001/tuto3.pdf")
        touch("EE2001/tuto3.pdf.ink.json")
        touch("EE2001/.tuto3.pdf.ink.json.tmp")
        touch("EE2001/tuto3.pdf.assets/picture-1.png")
        touch("EE2001/.versions/tuto3.pdf.ink.json.1.version")
        touch("EE2001/_revision_log/revision_log.json")
        touch("_ricknotes/presets.json")
        touch("EE2001/slides.pptx")
        touch("EE2001/.hidden.pdf")

        assertEquals(listOf("EE2001/", "  tuto3.pdf"), listed())
    }

    @Test
    fun `paths are relative to the Study folder with forward slashes`() {
        touch("Y1/Sem1/notes.pdf")

        val tree = StudyFolder(temp.root.toPath()).listTree { _, _ -> }
        val sem1 = (tree.children.single() as TreeNode.Folder).children.single() as TreeNode.Folder

        assertEquals("", tree.path)
        assertEquals("Y1/Sem1", sem1.path)
        assertEquals("Y1/Sem1/notes.pdf", sem1.children.single().path)
    }

    @Test
    fun `resolves a tree path back to the file on disk`() {
        val pdf = touch("Y1/Sem1/notes.pdf")

        assertEquals(pdf.toPath(), StudyFolder(temp.root.toPath()).resolve("Y1/Sem1/notes.pdf"))
    }

    @Test
    fun `an empty Study folder lists nothing`() {
        assertEquals(emptyList<String>(), listed())
    }

    @Test
    fun `a subfolder that can't be read is left out and reported, the rest still lists`() {
        touch("Y1/Sem1/notes.pdf")
        val locked = folder("Y1/Locked")
        assertTrue(locked.setReadable(false))
        try {
            val unreadable = mutableListOf<String>()

            val tree = StudyFolder(temp.root.toPath()).listTree { folder, _ -> unreadable.add(folder) }

            assertEquals(listOf("Y1/", "  Sem1/", "    notes.pdf"), tree.children.flatMap { outline(it) })
            assertEquals(listOf("Y1/Locked"), unreadable)
        } finally {
            locked.setReadable(true)
        }
    }

    @Test
    fun `a Study folder that can't be read fails`() {
        assertTrue(temp.root.setReadable(false))
        try {
            val error = assertThrows(StudyFolderListingException::class.java) { listed() }

            assertEquals("", error.folder)
        } finally {
            temp.root.setReadable(true)
        }
    }

    @Test
    fun `a Document knows its folder`() {
        assertEquals("Y1/Sem1", TreeNode.Document("a.pdf", "Y1/Sem1/a.pdf").folder)
        assertEquals("", TreeNode.Document("a.pdf", "a.pdf").folder)
    }

    @Test
    fun `an Ink file whose PDF is missing is listed as Orphaned ink among the PDFs`() {
        touch("EE2001/b.pdf")
        touch("EE2001/b.pdf.ink.json")
        touch("EE2001/old name.pdf.ink.json")
        touch("EE2001/old name.pdf.assets/picture-1.png")
        touch("EE2001/c.pdf")

        assertEquals(
            listOf("EE2001/", "  b.pdf", "  c.pdf", "  old name.pdf (orphaned ink)"),
            listed(),
        )
        val tree = StudyFolder(temp.root.toPath()).listTree { _, error -> throw error }
        val orphan = (tree.children.single() as TreeNode.Folder).children.last()
        assertEquals(TreeNode.OrphanedInk("old name.pdf", "EE2001/old name.pdf"), orphan)
    }

    @Test
    fun `the PDFs to link Orphaned ink to are the same folder's PDFs without ink`() {
        touch("EE2001/old.pdf.ink.json")
        touch("EE2001/inked.pdf")
        touch("EE2001/inked.pdf.ink.json")
        touch("EE2001/Renamed.pdf")
        touch("EE2001/another.PDF")
        touch("EE2001/notes.txt")
        touch("EE2001/tuto/inside.pdf")
        touch("elsewhere.pdf")

        val candidates = StudyFolder(temp.root.toPath()).linkCandidates("EE2001/old.pdf")

        assertEquals(listOf("EE2001/another.PDF", "EE2001/Renamed.pdf"), candidates)
    }
}
