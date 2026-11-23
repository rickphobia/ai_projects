package com.rickphobia.ricknotes.core.studyfolder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CourseFoldersTest {
    private val none = CourseFolders()

    @Test
    fun `a folder two levels in is a course without any setup`() {
        assertTrue(none.isCourse("y1s1/EE2001"))
        assertFalse(none.isCourse("y1s1"))
        assertFalse(none.isCourse("y1s1/EE2001/notes"))
    }

    @Test
    fun `Documents anywhere inside a two-level folder share its course`() {
        listOf("y1s1/EE2001/tutorial/tuto3.pdf", "y1s1/EE2001/notes/lec3.pdf", "y1s1/EE2001/pyp.pdf")
            .forEach { assertEquals("y1s1/EE2001", none.courseFolderOfDocument(it)) }
    }

    @Test
    fun `a Document outside any course has none`() {
        assertNull(none.courseFolderOfDocument("y1s1/timetable.pdf"))
        assertNull(none.courseFolderOfDocument("readme.pdf"))
    }

    @Test
    fun `a marked folder is the course of Documents inside it`() {
        val folders = none.mark("Calc")

        assertEquals("Calc", folders.courseFolderOfDocument("Calc/w1.pdf"))
    }

    @Test
    fun `the nearest course wins over a two-level folder above it`() {
        val folders = none.mark("y1s1/EE2001/lab")

        assertEquals("y1s1/EE2001/lab", folders.courseFolderOfDocument("y1s1/EE2001/lab/l1.pdf"))
        assertEquals("y1s1/EE2001", folders.courseFolderOfDocument("y1s1/EE2001/notes/n.pdf"))
    }

    @Test
    fun `an unmarked two-level folder is not a course, so its Documents look further up`() {
        val folders = none.unmark("y1s1/EE2001")

        assertFalse(folders.isCourse("y1s1/EE2001"))
        assertNull(folders.courseFolderOfDocument("y1s1/EE2001/notes/lec3.pdf"))
        assertEquals("y1s1", folders.mark("y1s1").courseFolderOfDocument("y1s1/EE2001/notes/lec3.pdf"))
    }

    @Test
    fun `marking and unmarking keep the lists minimal`() {
        assertEquals(none, none.unmark("y1s1/EE2001").mark("y1s1/EE2001"))
        assertEquals(none, none.mark("Misc").unmark("Misc"))
        assertEquals(CourseFolders(unmarked = setOf("y1s1/EE2001")), none.unmark("y1s1/EE2001"))
    }

    @Test
    fun `marks on and inside a renamed folder follow it`() {
        val folders =
            none
                .mark("Misc")
                .mark("y1s1/EE2001/labs")
                .unmark("y1s1/EE2001")
                .mark("y1s10")

        val renamed = folders.renamed("y1s1", "y1 sem1")

        assertEquals(setOf("Misc", "y1 sem1/EE2001/labs", "y1s10"), renamed.marked)
        assertEquals(setOf("y1 sem1/EE2001"), renamed.unmarked)
    }
}
