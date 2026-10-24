package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.Tool
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files
import java.nio.file.Path

class DocumentSessionsTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = FakeClock()
    private val closed = mutableListOf<Boolean>()

    // Runs each save at once, as if the save thread were idle.
    private val sessions = DocumentSessions<DocumentSession>({ it }, { save -> save() })
    private var opened = 0

    private val pdf: Path by lazy {
        folder.root
            .toPath()
            .resolve("Week 1.pdf")
            .also { Files.write(it, byteArrayOf(1, 2, 3)) }
    }

    private fun openTab(): DocumentSession =
        sessions.open(pdf) {
            opened++
            DocumentSession.open(pdf, 3, clock, object : SaveListener {})
        }

    private fun closeTab() = sessions.close(pdf) { saved -> closed.add(saved) }

    private val stroke =
        Stroke(
            StrokeId("s1"),
            PageId.ofPdfPage(0),
            Tool.PEN,
            PenColour.BLACK.argb,
            InkTool.Pen(PenColour.BLACK).widthPt,
            drawnAtMs = 1_760_000_000_000,
            points = listOf(StrokePoint(10f, 20f, 0.5f, 0), StrokePoint(11f, 22f, 0.75f, 9)),
        )

    @Test
    fun `two Tabs of one Document share one session`() {
        val first = openTab()
        val second = openTab()

        assertSame(first, second)
        assertEquals(1, opened)
    }

    @Test
    fun `closing one of two Tabs keeps the session and its undo history`() {
        val session = openTab()
        openTab()
        session.addStroke(stroke)

        closeTab()

        assertTrue(sessions.isOpen(pdf))
        assertSame(session, openTab())
        assertTrue(session.canUndo)
    }

    @Test
    fun `closing the last Tab saves the ink and ends the session`() {
        openTab().addStroke(stroke)

        closeTab()

        assertTrue(Files.exists(pdf.resolveSibling("Week 1.pdf.ink.json")))
        assertFalse(sessions.isOpen(pdf))
        assertEquals(listOf(true), closed)
        assertFalse(openTab().canUndo)
        assertEquals(2, opened)
    }

    @Test
    fun `a session whose last save failed is kept, so reopening gets every stroke back`() {
        openTab().addStroke(stroke)
        // A folder where the Ink file should be makes the save fail.
        Files.createDirectory(pdf.resolveSibling("Week 1.pdf.ink.json"))

        closeTab()

        assertEquals(listOf(false), closed)
        assertTrue(sessions.isOpen(pdf))
        assertTrue(openTab().canUndo)
    }

    @Test
    fun `closing a Document that isn't open is a bug`() {
        assertThrows(IllegalStateException::class.java) { closeTab() }
    }
}
