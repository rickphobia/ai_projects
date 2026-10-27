package com.rickphobia.ricknotes.core.revisionlog

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.session.Clock
import com.rickphobia.ricknotes.core.session.InkSaveFailed
import com.rickphobia.ricknotes.core.session.PageRect
import com.rickphobia.ricknotes.core.session.SaveListener
import com.rickphobia.ricknotes.core.session.SaveStatus
import com.rickphobia.ricknotes.core.session.Scheduled
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDate
import java.time.ZoneOffset

/** A clock that only moves when the test says so, running whatever falls due. */
private class FakeClock(
    private var now: Long,
) : Clock {
    private val tasks = mutableListOf<Pair<Long, () -> Unit>>()

    override fun nowMs(): Long = now

    override fun schedule(
        delayMs: Long,
        task: () -> Unit,
    ): Scheduled {
        val entry = now + delayMs to task
        tasks.add(entry)
        return Scheduled { tasks.remove(entry) }
    }

    fun advance(ms: Long) {
        val until = now + ms
        while (true) {
            val next = tasks.filter { it.first <= until }.minByOrNull { it.first } ?: break
            tasks.remove(next)
            now = next.first
            next.second()
        }
        now = until
    }
}

private class FailureCounter : SaveListener {
    var failures = 0

    override fun saveFailed(error: InkSaveFailed) {
        failures++
    }
}

// 2026-10-23 09:00 UTC.
private const val OCT_23_MORNING_MS = 1_792_746_000_000L
private val OCT_23: LocalDate = LocalDate.of(2026, 10, 23)

private val FRONT = byteArrayOf(1, 2, 3)
private val BACK = byteArrayOf(4, 5, 6, 7)

class RevisionLogSessionTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = FakeClock(OCT_23_MORNING_MS)
    private val course: Path by lazy {
        folder.root
            .toPath()
            .resolve("Y1/Sem1/EE2001")
            .also { Files.createDirectories(it) }
    }
    private val logFolder: Path get() = course.resolve("_revision_log")
    private val logFile: Path get() = logFolder.resolve("revision_log.json")

    private val source =
        EntrySource(
            documentPath = "Y1/Sem1/EE2001/tutorial/tuto3.pdf",
            pageId = PageId("pdf-4"),
            pageNumber = 4,
            area = PageRect(40.5f, 100f, 300.25f, 260f),
        )

    private fun open(listener: SaveListener = object : SaveListener {}) =
        RevisionLogSession.open(course, clock, ZoneOffset.UTC, listener)

    private fun reopen(session: RevisionLogSession): RevisionLogSession {
        session.saveNow()
        return open()
    }

    @Test
    fun `a Course folder with no Revision log opens empty and writes nothing`() {
        val session = open()

        session.saveNow()

        assertEquals(emptyList<Entry>(), session.entries)
        assertFalse(session.readOnly)
        assertFalse(Files.exists(logFolder))
    }

    @Test
    fun `an added Entry reopens with its labels, its Snips and a first due date 3 days on`() {
        val session = open()

        val added = session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        val reopened = reopen(session)

        val entry = reopened.entries.single()
        assertEquals(added, entry)
        assertEquals(EntryKind.MISTAKE, entry.kind)
        assertEquals(source, entry.source)
        assertEquals(OCT_23_MORNING_MS, entry.addedAtMs)
        assertEquals(OCT_23.plusDays(3), entry.schedule.dueDate)
        assertEquals(3, entry.schedule.gapDays)
        assertNull(entry.category)
        assertNull(entry.why)
        assertArrayEquals(FRONT, Files.readAllBytes(reopened.frontSnip(entry)))
        assertArrayEquals(BACK, Files.readAllBytes(reopened.backSnip(entry)))
        assertEquals(logFolder, reopened.frontSnip(entry).parent)
    }

    @Test
    fun `the Snips are on disk as soon as the Entry is added, before the log names them`() {
        val session = open()

        val entry = session.addEntry(EntryKind.KEY_POINT, source, Snips(FRONT, BACK))

        assertTrue(Files.exists(session.frontSnip(entry)))
        assertTrue(Files.exists(session.backSnip(entry)))
        assertFalse(Files.exists(logFile))
        assertEquals(SaveStatus.PENDING, session.status)
        clock.advance(RevisionLogSession.SAVE_DELAY_MS)
        assertTrue(Files.exists(logFile))
        assertEquals(SaveStatus.SAVED, session.status)
    }

    @Test
    fun `each Entry gets its own ID and Snips`() {
        val session = open()

        val first = session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        val second = session.addEntry(EntryKind.KEY_POINT, source, Snips(BACK, FRONT))
        val reopened = reopen(session)

        assertTrue(first.id != second.id)
        assertEquals(listOf(first, second), reopened.entries)
        assertArrayEquals(BACK, Files.readAllBytes(reopened.frontSnip(second)))
    }

    @Test
    fun `a Mistake's category and why line are edited and reopen`() {
        val session = open()
        val entry = session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))

        session.edit(entry.id, MistakeCategory.ALGEBRA, "  dropped the minus sign  ")
        val reopened = reopen(session).entries.single()

        assertEquals(MistakeCategory.ALGEBRA, reopened.category)
        assertEquals("dropped the minus sign", reopened.why)
    }

    @Test
    fun `a blank why line is no why line`() {
        val session = open()
        val entry = session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        session.edit(entry.id, MistakeCategory.CONCEPT, "first try")

        session.edit(entry.id, null, "   ")

        assertNull(session.entries.single().why)
        assertNull(session.entries.single().category)
    }

    @Test
    fun `a Key point takes a why line but no category`() {
        val session = open()
        val entry = session.addEntry(EntryKind.KEY_POINT, source, Snips(FRONT, BACK))

        session.edit(entry.id, null, "on the exam every year")
        assertThrows(IllegalArgumentException::class.java) {
            session.edit(entry.id, MistakeCategory.CARELESS, "x")
        }

        assertEquals("on the exam every year", reopen(session).entries.single().why)
    }

    @Test
    fun `every category round-trips`() {
        val session = open()
        val ids =
            MistakeCategory.entries.map { category ->
                session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK)).id.also {
                    session.edit(it, category, null)
                }
            }

        val reopened = reopen(session)

        assertEquals(MistakeCategory.entries, ids.map { id -> reopened.entries.single { it.id == id }.category })
    }

    @Test
    fun `a damaged log opens read-only, says why, and is never overwritten`() {
        Files.createDirectories(logFolder)
        Files.write(logFile, "{ not json".toByteArray())

        val session = open()

        assertTrue(session.readOnly)
        assertEquals("revision_log.json", session.damaged?.fileName)
        assertEquals(emptyList<Entry>(), session.entries)
        assertThrows(IllegalStateException::class.java) {
            session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        }
        session.saveNow()
        clock.advance(RevisionLogSession.VERSION_INTERVAL_MS * 2)
        assertEquals("{ not json", String(Files.readAllBytes(logFile)))
    }

    @Test
    fun `a log from a newer app opens read-only`() {
        Files.createDirectories(logFolder)
        Files.write(logFile, """{"formatVersion": 99, "entries": []}""".toByteArray())

        assertTrue(open().readOnly)
    }

    @Test
    fun `a failed save leaves the old log whole and is retried`() {
        val listener = FailureCounter()
        val session = open(listener)
        session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        session.saveNow()
        val saved = Files.readAllBytes(logFile)
        // A folder where the temporary file goes makes every write fail, as a full disk would.
        val temporary = logFolder.resolve(".revision_log.json.tmp")
        Files.createDirectory(temporary)
        Files.write(temporary.resolve("keep"), byteArrayOf(0))

        session.addEntry(EntryKind.KEY_POINT, source, Snips(FRONT, BACK))
        clock.advance(RevisionLogSession.SAVE_DELAY_MS)

        assertArrayEquals(saved, Files.readAllBytes(logFile))
        assertEquals(SaveStatus.FAILED, session.status)
        assertEquals(1, listener.failures)
        Files.delete(temporary.resolve("keep"))
        Files.delete(temporary)
        clock.advance(RevisionLogSession.RETRY_DELAY_MS)
        assertEquals(SaveStatus.SAVED, session.status)
        assertEquals(2, open().entries.size)
    }

    @Test
    fun `a Version of the log is taken when it opens`() {
        val first = open()
        first.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        first.saveNow()
        val saved = Files.readAllBytes(logFile)

        open()

        val versions = Files.list(logFolder.resolve(".versions")).use { it.iterator().asSequence().toList() }
        assertEquals(1, versions.size)
        assertArrayEquals(saved, Files.readAllBytes(versions.single()))
    }

    @Test
    fun `adding a Snip that can't be written adds no Entry`() {
        val session = open()
        // A file where the log folder goes: nothing can be written inside it.
        Files.write(logFolder, byteArrayOf(0))

        assertThrows(SnipSaveFailed::class.java) {
            session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        }

        assertEquals(emptyList<Entry>(), session.entries)
        assertEquals(SaveStatus.SAVED, session.status)
    }

    @Test
    fun `editing an Entry that isn't there fails`() {
        val session = open()

        assertThrows(IllegalArgumentException::class.java) {
            session.edit(EntryId("missing"), null, "why")
        }
    }

    @Test
    fun `a deleted Entry is gone after reopening, and the others stay`() {
        val session = open()
        val kept = session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        val deleted = session.addEntry(EntryKind.KEY_POINT, source, Snips(FRONT, BACK))

        session.delete(deleted.id)
        val reopened = reopen(session)

        assertEquals(listOf(kept), reopened.entries)
    }

    @Test
    fun `deleting keeps the Snips, so a restored Version still finds them`() {
        val session = open()
        val entry = session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))

        session.delete(entry.id)

        assertTrue(Files.exists(session.frontSnip(entry)))
        assertTrue(Files.exists(session.backSnip(entry)))
    }

    @Test
    fun `deleting an Entry that isn't there is refused`() {
        val session = open()

        assertThrows(IllegalArgumentException::class.java) { session.delete(EntryId("missing")) }
    }

    @Test
    fun `a damaged log refuses to delete`() {
        Files.createDirectories(logFolder)
        Files.write(logFile, "not json".toByteArray())
        val session = open()

        assertThrows(IllegalStateException::class.java) { session.delete(EntryId("any")) }
    }

    @Test
    fun `the list is newest first and filters by kind`() {
        val session = open()
        val first = session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        clock.advance(1_000)
        val second = session.addEntry(EntryKind.KEY_POINT, source, Snips(FRONT, BACK))
        clock.advance(1_000)
        val third = session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))

        assertEquals(listOf(third, second, first), session.newestFirst(kind = null))
        assertEquals(listOf(third, first), session.newestFirst(EntryKind.MISTAKE))
        assertEquals(listOf(second), session.newestFirst(EntryKind.KEY_POINT))
    }

    @Test
    fun `a Conflict copy beside the log is reported and nothing is merged from it`() {
        val session = open()
        session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        session.saveNow()
        Files.write(logFolder.resolve("revision_log (conflict 2026-10-23).json"), "{}".toByteArray())

        val reopened = open()

        assertEquals(listOf("revision_log (conflict 2026-10-23).json"), reopened.conflictCopies)
        assertEquals(1, reopened.entries.size)
    }

    @Test
    fun `the log itself, its temporary file and Snips are not Conflict copies`() {
        val session = open()
        session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK))
        session.saveNow()
        Files.write(logFolder.resolve(".revision_log.json.tmp"), byteArrayOf())

        assertEquals(emptyList<String>(), open().conflictCopies)
    }

    @Test
    fun `an Entry from a Red mark reopens with its red stroke IDs and its box`() {
        val session = open()
        val strokes = listOf(StrokeId("s-1"), StrokeId("s-2"))
        val box = PageRect(120f, 300.5f, 260f, 410f)

        val added = session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK), strokes, box)
        val entry = reopen(session).entries.single()

        assertEquals(added, entry)
        assertEquals(strokes, entry.redStrokeIds)
        assertEquals(box, entry.box)
    }

    @Test
    fun `the logged red stroke IDs are those of one Document's Entries only`() {
        val session = open()
        val other = source.copy(documentPath = "Y1/Sem1/EE2001/tutorial/tuto4.pdf")
        session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK), listOf(StrokeId("a"), StrokeId("b")))
        session.addEntry(EntryKind.MISTAKE, other, Snips(FRONT, BACK), listOf(StrokeId("c")))
        session.addEntry(EntryKind.MISTAKE, source, Snips(FRONT, BACK), listOf(StrokeId("d")))
        session.addEntry(EntryKind.KEY_POINT, source, Snips(FRONT, BACK))

        val logged = reopen(session).loggedRedStrokes(source.documentPath)

        assertEquals(setOf(StrokeId("a"), StrokeId("b"), StrokeId("d")), logged)
    }

    @Test
    fun `a log from before Red marks opens with no stroke IDs or boxes and keeps its format version`() {
        Files.createDirectories(logFolder)
        Files.write(
            logFile,
            """
            {"formatVersion": 1, "entries": [{"id": "e-1", "kind": "mistake",
              "document": "Y1/Sem1/EE2001/tutorial/tuto3.pdf", "page": "pdf-4", "pageNumber": 4,
              "area": {"left": 0, "top": 0, "right": 10, "bottom": 10},
              "addedAtMs": 1, "dueDate": "2026-10-26", "gapDays": 3}]}
            """.trimIndent().toByteArray(),
        )
        val session = open()

        val entry = session.entries.single()
        session.edit(entry.id, MistakeCategory.ALGEBRA, null)
        session.saveNow()

        assertEquals(emptyList<StrokeId>(), entry.redStrokeIds)
        assertNull(entry.box)
        assertEquals(emptySet<StrokeId>(), session.loggedRedStrokes(entry.source.documentPath))
        val written = String(Files.readAllBytes(logFile), Charsets.UTF_8)
        assertTrue(written.contains("\"formatVersion\": 1"))
        assertFalse(written.contains("box"))
    }
}
