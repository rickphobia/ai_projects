package com.rickphobia.ricknotes.core.revisionlog

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.Tool
import com.rickphobia.ricknotes.core.session.FakeClock
import com.rickphobia.ricknotes.core.session.PageRect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files
import java.nio.file.Path
import java.time.ZoneOffset

// 2026-10-23 09:00 UTC.
private const val OCT_23_MORNING_MS = 1_792_746_000_000L
private const val DAY_MS = 24 * 60 * 60 * 1_000L

private val SNIPS = Snips(byteArrayOf(1), byteArrayOf(2))

class RedoTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = FakeClock().also { it.advance(OCT_23_MORNING_MS) }
    private val course: Path by lazy { folder.root.toPath().resolve("Y1/Sem1/EE2001").also { Files.createDirectories(it) } }

    private fun open() = RevisionLogSession.open(course, clock, ZoneOffset.UTC)

    private fun reopen(session: RevisionLogSession): RevisionLogSession {
        session.saveNow()
        return open()
    }

    private fun add(
        session: RevisionLogSession,
        kind: EntryKind = EntryKind.MISTAKE,
    ) = session.addEntry(
        kind,
        EntrySource("Y1/Sem1/EE2001/tuto3.pdf", PageId("pdf-1"), 1, PageRect(0f, 0f, 10f, 10f)),
        SNIPS,
    )

    // Points on the 1/100 pt and 1/1000 pressure grid the packing keeps, so they come back exactly.
    private fun stroke(
        id: String,
        tool: Tool = Tool.PEN,
    ) = Stroke(
        id = StrokeId(id),
        pageId = Redo.PAGE,
        tool = tool,
        colourArgb = 0xFF1A2B3C.toInt(),
        widthPt = 1.5f,
        drawnAtMs = OCT_23_MORNING_MS + 500,
        points =
            listOf(
                StrokePoint(12.34f, 56.78f, 0.5f, 0),
                StrokePoint(12.5f, 57f, 0.625f, 8),
                StrokePoint(-3.25f, 400.01f, 1f, 16),
            ),
    )

    @Test
    fun `a Redo round-trips its strokes exactly`() {
        val session = open()
        val entry = add(session)
        val strokes = listOf(stroke("a"), stroke("b", Tool.HIGHLIGHTER))

        session.addRedo(entry.id, strokes)
        val redo = reopen(session).entries.single().redos.single()

        assertEquals(strokes, redo.strokes)
        assertEquals(OCT_23_MORNING_MS, redo.atMs)
    }

    @Test
    fun `every Redo is kept, oldest first`() {
        val session = open()
        val entry = add(session)

        session.addRedo(entry.id, listOf(stroke("first")))
        clock.advance(3 * DAY_MS)
        session.addRedo(entry.id, listOf(stroke("second")))
        val redos = reopen(session).entries.single().redos

        assertEquals(listOf("first", "second"), redos.map { it.strokes.single().id.value })
        assertEquals(listOf(OCT_23_MORNING_MS, OCT_23_MORNING_MS + 3 * DAY_MS), redos.map { it.atMs })
    }

    @Test
    fun `the strokes are packed like Ink file points`() {
        val session = open()
        session.addRedo(add(session).id, listOf(stroke("a")))
        session.saveNow()

        val text = String(Files.readAllBytes(course.resolve("_revision_log/revision_log.json")), Charsets.UTF_8)

        assertTrue(text, text.contains("\"1234,5678,500,0,16,22,125,8,-1575,34301,375,8\""))
    }

    @Test
    fun `a Key point takes no Redo`() {
        val session = open()
        val keyPoint = add(session, EntryKind.KEY_POINT)

        assertThrows(IllegalArgumentException::class.java) { session.addRedo(keyPoint.id, listOf(stroke("a"))) }
    }

    @Test
    fun `an empty Redo is refused`() {
        val session = open()
        val entry = add(session)

        assertThrows(IllegalArgumentException::class.java) { session.addRedo(entry.id, emptyList()) }
    }

    @Test
    fun `a Redo for an Entry that isn't there is refused`() {
        assertThrows(IllegalArgumentException::class.java) { open().addRedo(EntryId("missing"), listOf(stroke("a"))) }
    }
}
