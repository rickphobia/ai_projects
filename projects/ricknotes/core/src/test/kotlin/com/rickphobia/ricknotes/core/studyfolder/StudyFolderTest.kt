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
        }

    private fun listed() = StudyFolder(temp.root.toPath()).listTree().children.flatMap { outline(it) }

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
        touch("EE2001/slides.pptx")
        touch("EE2001/.hidden.pdf")

        assertEquals(listOf("EE2001/", "  tuto3.pdf"), listed())
    }

    @Test
    fun `paths are relative to the Study folder with forward slashes`() {
        touch("Y1/Sem1/notes.pdf")

        val tree = StudyFolder(temp.root.toPath()).listTree()
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
    fun `a folder that can't be read fails naming it`() {
        val locked = folder("Y1/Locked")
        assertTrue(locked.setReadable(false))
        try {
            val error = assertThrows(StudyFolderListingException::class.java) { listed() }

            assertEquals("Y1/Locked", error.folder)
        } finally {
            locked.setReadable(true)
        }
    }
}
