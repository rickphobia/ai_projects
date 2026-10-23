package com.rickphobia.ricknotes.core.studyfolder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CourseFoldersTest {
    private val none = CourseFolders()

    @Test
    fun `a folder three levels in is a course without any setup`() {
        assertTrue(none.isCourse("Y1/Sem1/EE2001"))
        assertFalse(none.isCourse("Y1/Sem1"))
        assertFalse(none.isCourse("Y1/Sem1/EE2001/notes"))
    }

    @Test
    fun `Documents anywhere inside a depth-3 folder share its course`() {
        listOf("Y1/Sem1/EE2001/tutorial/tuto3.pdf", "Y1/Sem1/EE2001/notes/lec3.pdf", "Y1/Sem1/EE2001/pyp.pdf")
            .forEach { assertEquals("Y1/Sem1/EE2001", none.courseFolderOfDocument(it)) }
    }

    @Test
    fun `a Document outside any course has none`() {
        assertNull(none.courseFolderOfDocument("Y1/Sem1/timetable.pdf"))
        assertNull(none.courseFolderOfDocument("readme.pdf"))
    }

    @Test
    fun `a marked folder is the course of Documents inside it`() {
        val folders = none.mark("Calc")

        assertEquals("Calc", folders.courseFolderOfDocument("Calc/week1/w1.pdf"))
    }

    @Test
    fun `the nearest course wins over a depth-3 folder above it`() {
        val folders = none.mark("Y1/Sem1/EE2001/lab")

        assertEquals("Y1/Sem1/EE2001/lab", folders.courseFolderOfDocument("Y1/Sem1/EE2001/lab/l1.pdf"))
        assertEquals("Y1/Sem1/EE2001", folders.courseFolderOfDocument("Y1/Sem1/EE2001/notes/n.pdf"))
    }

    @Test
    fun `an unmarked depth-3 folder is not a course, so its Documents look further up`() {
        val folders = none.unmark("Y1/Sem1/EE2001")

        assertFalse(folders.isCourse("Y1/Sem1/EE2001"))
        assertNull(folders.courseFolderOfDocument("Y1/Sem1/EE2001/notes/lec3.pdf"))
        assertEquals("Y1/Sem1", folders.mark("Y1/Sem1").courseFolderOfDocument("Y1/Sem1/EE2001/notes/lec3.pdf"))
    }

    @Test
    fun `marking and unmarking keep the lists minimal`() {
        assertEquals(none, none.unmark("Y1/Sem1/EE2001").mark("Y1/Sem1/EE2001"))
        assertEquals(none, none.mark("Misc").unmark("Misc"))
        assertEquals(CourseFolders(unmarked = setOf("Y1/Sem1/EE2001")), none.unmark("Y1/Sem1/EE2001"))
    }
}
