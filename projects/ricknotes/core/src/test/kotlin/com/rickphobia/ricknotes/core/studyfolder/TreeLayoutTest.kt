package com.rickphobia.ricknotes.core.studyfolder

import org.junit.Assert.assertEquals
import org.junit.Test

class TreeLayoutTest {
    private fun doc(path: String) = TreeNode.Document(path.substringAfterLast('/'), path)

    private fun dir(
        path: String,
        vararg children: TreeNode,
    ) = TreeNode.Folder(path.substringAfterLast('/'), path, children.toList())

    private val tree =
        dir(
            "",
            dir(
                "Y1",
                dir("Y1/Sem1", dir("Y1/Sem1/EE2001", doc("Y1/Sem1/EE2001/lec1.pdf"))),
                dir("Y1/Sem2", dir("Y1/Sem2/EE2002", doc("Y1/Sem2/EE2002/lec1.pdf"))),
            ),
            dir("Y2", dir("Y2/Sem1"), dir("Y2/Sem2")),
            doc("top.pdf"),
        )

    @Test
    fun `opens on the semester of the most recent Document`() {
        val expanded = TreeLayout.initiallyExpanded(tree, listOf("Y1/Sem1/EE2001/lec1.pdf", "Y1/Sem2/EE2002/lec1.pdf"))

        assertEquals(setOf("Y1", "Y1/Sem1"), expanded)
    }

    @Test
    fun `skips a recent Document that is no longer in the tree`() {
        val expanded = TreeLayout.initiallyExpanded(tree, listOf("Y9/Sem1/gone.pdf", "Y1/Sem2/EE2002/lec1.pdf"))

        assertEquals(setOf("Y1", "Y1/Sem2"), expanded)
    }

    @Test
    fun `skips a recent Document that isn't inside a semester`() {
        val expanded = TreeLayout.initiallyExpanded(tree, listOf("top.pdf", "Y1/Sem2/EE2002/lec1.pdf"))

        assertEquals(setOf("Y1", "Y1/Sem2"), expanded)
    }

    @Test
    fun `with nothing recent, opens on the last semester of the last year`() {
        assertEquals(setOf("Y2", "Y2/Sem2"), TreeLayout.initiallyExpanded(tree, emptyList()))
    }

    @Test
    fun `with no folders, nothing is expanded`() {
        assertEquals(emptySet<String>(), TreeLayout.initiallyExpanded(dir("", doc("a.pdf")), emptyList()))
    }

    @Test
    fun `collapsed folders hide their children`() {
        val rows = TreeLayout.visibleRows(tree, expanded = emptySet())

        assertEquals(listOf("Y1" to 0, "Y2" to 0, "top.pdf" to 0), rows.map { it.node.path to it.depth })
    }

    @Test
    fun `expanded folders show their children one level deeper`() {
        val rows = TreeLayout.visibleRows(tree, expanded = setOf("Y1", "Y1/Sem1", "Y1/Sem1/EE2001"))

        assertEquals(
            listOf(
                "Y1" to 0,
                "Y1/Sem1" to 1,
                "Y1/Sem1/EE2001" to 2,
                "Y1/Sem1/EE2001/lec1.pdf" to 3,
                "Y1/Sem2" to 1,
                "Y2" to 0,
                "top.pdf" to 0,
            ),
            rows.map { it.node.path to it.depth },
        )
    }

    @Test
    fun `an expanded folder inside a collapsed one stays hidden`() {
        val rows = TreeLayout.visibleRows(tree, expanded = setOf("Y1/Sem1"))

        assertEquals(listOf("Y1", "Y2", "top.pdf"), rows.map { it.node.path })
    }

    @Test
    fun `toggling a folder expands or collapses it`() {
        val opened = TreeLayout.toggle(setOf("Y1"), "Y1/Sem1")

        assertEquals(setOf("Y1", "Y1/Sem1"), opened)
        assertEquals(setOf("Y1"), TreeLayout.toggle(opened, "Y1/Sem1"))
    }

    @Test
    fun `finds the Documents the tree still has, in the order asked`() {
        val found = TreeLayout.documents(tree, listOf("top.pdf", "Y9/gone.pdf", "Y1/Sem1/EE2001/lec1.pdf"))

        assertEquals(listOf("top.pdf", "Y1/Sem1/EE2001/lec1.pdf"), found.map { it.path })
    }
}
