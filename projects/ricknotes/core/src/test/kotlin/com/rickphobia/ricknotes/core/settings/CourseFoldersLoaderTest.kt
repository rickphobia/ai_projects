package com.rickphobia.ricknotes.core.settings

import com.rickphobia.ricknotes.core.settings.CourseFoldersLoader.COURSE_MARKS_KEY
import com.rickphobia.ricknotes.core.settings.CourseFoldersLoader.COURSE_UNMARKS_KEY
import com.rickphobia.ricknotes.core.studyfolder.CourseFolders
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class CourseFoldersLoaderTest {
    private fun sourceOf(vararg stored: Pair<String, String>) = SettingsSource { key -> stored.toMap()[key] }

    private fun rejected(vararg stored: Pair<String, String>) =
        assertThrows(InvalidSettingException::class.java) { CourseFoldersLoader.load(sourceOf(*stored)) }

    @Test
    fun `nothing stored loads no marks`() {
        assertEquals(CourseFolders(), CourseFoldersLoader.load(sourceOf()))
    }

    @Test
    fun `marks and unmarks round-trip, commas in names included`() {
        val folders = CourseFolders(marked = setOf("Misc/Calc, Linear", "Y2"), unmarked = setOf("Y1/Sem1/EE2001"))
        val saved = mutableMapOf<String, String>()

        CourseFoldersLoader.save({ key, value -> saved[key] = value }, folders)

        assertEquals(folders, CourseFoldersLoader.load { saved[it] })
    }

    @Test
    fun `a mark that is not a folder path is rejected naming the list`() {
        listOf("/Y1", "Y1/", "Y1//Sem1", "Y1/../Y2").forEach { bad ->
            assertEquals(COURSE_MARKS_KEY, rejected(COURSE_MARKS_KEY to bad).key)
        }
    }

    @Test
    fun `a folder listed twice is rejected`() {
        assertEquals("lists a folder twice", rejected(COURSE_UNMARKS_KEY to "Y1/S1/A\nY1/S1/A").reason)
    }

    @Test
    fun `a folder both marked and unmarked is rejected`() {
        val error = rejected(COURSE_MARKS_KEY to "Y1/S1/A", COURSE_UNMARKS_KEY to "Y1/S1/A")

        assertEquals("also marks \"Y1/S1/A\"", error.reason)
    }
}
