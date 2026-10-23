package com.rickphobia.gloss.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SelectionTest {
    @Test
    fun `keeps the selected text without the whitespace around it`() {
        assertEquals("a garret", Selection.from("  a garret\n")?.text)
    }

    @Test
    fun `keeps line breaks inside a passage`() {
        assertEquals("He was nervous.\nHe went out.", Selection.from("He was nervous.\nHe went out.")?.text)
    }

    @Test
    fun `there is no Selection when nothing was selected`() {
        assertNull(Selection.from(null))
        assertNull(Selection.from(""))
        assertNull(Selection.from(" \n\t "))
    }
}
