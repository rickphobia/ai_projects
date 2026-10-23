package com.rickphobia.ricknotes.core.revisionlog

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.session.FakeClock
import com.rickphobia.ricknotes.core.session.PageRect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset

// 2026-10-23 09:00 UTC.
private const val OCT_23_MORNING_MS = 1_792_746_000_000L
private val OCT_23: LocalDate = LocalDate.of(2026, 10, 23)
private const val DAY_MS = 24 * 60 * 60 * 1_000L

private val SNIPS = Snips(byteArrayOf(1), byteArrayOf(2))

class ReviewTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = FakeClock().also { it.advance(OCT_23_MORNING_MS) }
    private val studyFolder: Path by lazy { folder.root.toPath() }

    // Like the app, one session per Course folder, so the queue and the test share them.
    private val sessions = mutableMapOf<Path, RevisionLogSession>()

    private fun session(
        course: String,
        zone: ZoneId = ZoneOffset.UTC,
    ): RevisionLogSession =
        sessions.getOrPut(studyFolder.resolve(course)) {
            RevisionLogSession.open(studyFolder.resolve(course).also { Files.createDirectories(it) }, clock, zone)
        }

    private fun add(
        course: String,
        kind: EntryKind = EntryKind.MISTAKE,
    ): Entry =
        session(course).addEntry(
            kind,
            EntrySource("$course/tutorial/tuto3.pdf", PageId("pdf-1"), 1, PageRect(0f, 0f, 10f, 10f)),
            SNIPS,
        )

    private fun queue(): List<DueCourse> =
        ReviewQueue.due(studyFolder, { sessions.getValue(it) }) { _, error -> throw error }

    private fun afterDays(days: Int) = clock.advance(days * DAY_MS)

    // Rates [id] once a day until it is next due, [times] times, and returns the gaps it got.
    private fun goodGaps(
        session: RevisionLogSession,
        id: EntryId,
        times: Int,
    ): List<Int> =
        (1..times).map {
            val gap =
                session.entries
                    .single { it.id == id }
                    .schedule.gapDays
            afterDays(gap)
            session.rate(id, Grade.GOOD).schedule.gapDays
        }

    @Test
    fun `a new Entry is not due until 3 days after it was added`() {
        val session = session("Y1/Sem1/EE2001")
        val entry = add("Y1/Sem1/EE2001")

        assertEquals(OCT_23.plusDays(ReviewSchedule.FIRST_GAP_DAYS.toLong()), entry.schedule.dueDate)
        assertEquals(emptyList<Entry>(), session.due())
        afterDays(2)
        assertEquals(emptyList<Entry>(), session.due())
        afterDays(1)
        assertEquals(listOf(entry.id), session.due().map { it.id })
    }

    @Test
    fun `Good stretches the gap 3, 7, 16, 37 days`() {
        val session = session("Y1/Sem1/EE2001")
        val entry = add("Y1/Sem1/EE2001")

        assertEquals(listOf(7, 16, 37), goodGaps(session, entry.id, times = 3))
        assertEquals(
            clock.today().plusDays(37),
            session.entries
                .single()
                .schedule.dueDate,
        )
    }

    @Test
    fun `Again brings it back tomorrow, and the next Good starts over at 3 days`() {
        val session = session("Y1/Sem1/EE2001")
        val entry = add("Y1/Sem1/EE2001")
        goodGaps(session, entry.id, times = 2)
        afterDays(16)

        val again = session.rate(entry.id, Grade.AGAIN)

        assertEquals(clock.today().plusDays(1), again.schedule.dueDate)
        assertEquals(emptyList<Entry>(), session.due())
        afterDays(1)
        assertEquals(1, session.due().size)
        assertEquals(3, session.rate(entry.id, Grade.GOOD).schedule.gapDays)
        assertEquals(listOf(7), goodGaps(session, entry.id, times = 1))
    }

    @Test
    fun `each rating is kept with its date and survives reopening`() {
        val session = session("Y1/Sem1/EE2001")
        val entry = add("Y1/Sem1/EE2001")
        afterDays(3)

        session.rate(entry.id, Grade.AGAIN)
        afterDays(1)
        session.rate(entry.id, Grade.GOOD)
        // Saved by itself after the save delay, as when Review is left halfway.
        clock.advance(RevisionLogSession.SAVE_DELAY_MS)
        val reopened = RevisionLogSession.open(studyFolder.resolve("Y1/Sem1/EE2001"), clock, ZoneOffset.UTC)

        val kept = reopened.entries.single()
        assertEquals(
            listOf(Grade.AGAIN, Grade.GOOD),
            kept.ratings.map { it.grade },
        )
        assertEquals(OCT_23_MORNING_MS + 4 * DAY_MS, kept.ratings.last().atMs)
        assertEquals(session.entries.single().schedule, kept.schedule)
    }

    @Test
    fun `leaving Review halfway keeps the ratings already given`() {
        val course = "Y1/Sem1/EE2001"
        val rated = add(course)
        val alsoRated = add(course, EntryKind.KEY_POINT)
        val notRated = add(course)
        afterDays(3)

        session(course).rate(rated.id, Grade.GOOD)
        session(course).rate(alsoRated.id, Grade.AGAIN)
        session(course).saveNow()
        val reopened = RevisionLogSession.open(studyFolder.resolve(course), clock, ZoneOffset.UTC)

        assertEquals(listOf(notRated.id), reopened.due().map { it.id })
        assertEquals(
            1,
            reopened.entries
                .single { it.id == rated.id }
                .ratings.size,
        )
    }

    @Test
    fun `rating an Entry that isn't there is refused, and so is rating in a damaged log`() {
        val session = session("Y1/Sem1/EE2001")
        assertThrows(IllegalArgumentException::class.java) { session.rate(EntryId("missing"), Grade.GOOD) }

        val damaged = studyFolder.resolve("Y1/Sem1/CS1010/_revision_log").also { Files.createDirectories(it) }
        Files.write(damaged.resolve("revision_log.json"), "not json".toByteArray())
        assertThrows(IllegalStateException::class.java) {
            session("Y1/Sem1/CS1010").rate(EntryId("any"), Grade.GOOD)
        }
    }

    @Test
    fun `due means on or before today in the tablet's time zone`() {
        // 09:00 UTC is 23:00 the day before in Honolulu (UTC-10).
        val honolulu = session("Y1/Sem1/EE2001", ZoneId.of("Pacific/Honolulu"))
        val entry =
            honolulu.addEntry(
                EntryKind.MISTAKE,
                EntrySource("Y1/Sem1/EE2001/notes/lec3.pdf", PageId("pdf-1"), 1, PageRect(0f, 0f, 1f, 1f)),
                SNIPS,
            )

        assertEquals(OCT_23.plusDays(2), entry.schedule.dueDate)
        afterDays(2)
        assertEquals(emptyList<Entry>(), honolulu.due())
        // Midnight in Honolulu is 10:00 UTC.
        clock.advance(60 * 60 * 1_000L)
        assertEquals(1, honolulu.due().size)
    }

    @Test
    fun `the queue groups due Entries by course, oldest due first, and leaves out what isn't due`() {
        val ee = "Y1/Sem1/EE2001"
        val cs = "Y1/Sem1/CS1010"
        val eeOld = add(ee)
        val csOld = add(cs, EntryKind.KEY_POINT)
        afterDays(1)
        val eeNewer = add(ee, EntryKind.KEY_POINT)
        afterDays(2)
        val notDueYet = add(ee)
        afterDays(2)

        val queue = queue()

        assertEquals(listOf(cs, ee), queue.map { it.courseFolder })
        assertEquals(listOf(csOld.id), queue[0].entries.map { it.id })
        assertEquals(listOf(eeOld.id, eeNewer.id), queue[1].entries.map { it.id })
        assertTrue(notDueYet.id !in queue[1].entries.map { it.id })
        assertEquals(3, queue.sumOf { it.entries.size })
    }

    @Test
    fun `a course with nothing due is left out`() {
        add("Y1/Sem1/EE2001")
        add("Y1/Sem2/MA1511")
        afterDays(3)
        session("Y1/Sem2/MA1511").let { it.rate(it.entries.single().id, Grade.GOOD) }

        assertEquals(listOf("Y1/Sem1/EE2001"), queue().map { it.courseFolder })
    }

    @Test
    fun `a Revision log in a folder that is no longer a Course folder is still reviewed`() {
        // Any `_revision_log` counts, at any depth: unmarking a folder never hides its Entries.
        add("Y1/Odd/Folder/Deep")
        add("Y1")
        afterDays(3)

        assertEquals(listOf("Y1", "Y1/Odd/Folder/Deep"), queue().map { it.courseFolder })
    }

    @Test
    fun `app files and hidden folders are not searched for logs`() {
        add("Y1/Sem1/EE2001")
        session("Y1/Sem1/EE2001").saveNow()
        Files.createDirectories(studyFolder.resolve("Y1/Sem1/EE2001/notes/lec3.pdf.assets/_revision_log"))
        Files.createDirectories(studyFolder.resolve(".trash/old/_revision_log"))

        assertEquals(
            listOf(studyFolder.resolve("Y1/Sem1/EE2001")),
            ReviewQueue.courseFoldersWithLogs(studyFolder) { _, error -> throw error },
        )
    }

    @Test
    fun `an unreadable folder is reported and the rest is still searched`() {
        add("Y1/Sem1/EE2001")
        session("Y1/Sem1/EE2001").saveNow()
        val locked = studyFolder.resolve("Y2").also { Files.createDirectories(it) }
        val reported = mutableListOf<Path>()
        assertTrue(locked.toFile().setReadable(false))
        try {
            val found = ReviewQueue.courseFoldersWithLogs(studyFolder) { path, _: IOException -> reported.add(path) }

            assertEquals(listOf(studyFolder.resolve("Y1/Sem1/EE2001")), found)
            assertEquals(listOf(locked), reported)
        } finally {
            locked.toFile().setReadable(true)
        }
    }

    private fun FakeClock.today(): LocalDate =
        java.time.Instant
            .ofEpochMilli(nowMs())
            .atZone(ZoneOffset.UTC)
            .toLocalDate()
}
