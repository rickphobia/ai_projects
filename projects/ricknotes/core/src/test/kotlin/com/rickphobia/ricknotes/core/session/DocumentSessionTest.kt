package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.Tool
import com.rickphobia.ricknotes.core.inkfile.InkFile
import com.rickphobia.ricknotes.core.inkfile.InkFileCodec
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files
import java.nio.file.Path

private class RecordingListener : SaveListener {
    val statuses = mutableListOf<SaveStatus>()
    val failures = mutableListOf<InkSaveFailed>()
    val versionFailures = mutableListOf<VersionFailed>()
    var saves = 0

    override fun statusChanged(status: SaveStatus) {
        statuses.add(status)
    }

    override fun saved(
        fileName: String,
        bytes: Int,
        durationMs: Long,
    ) {
        saves++
    }

    override fun saveFailed(error: InkSaveFailed) {
        failures.add(error)
    }

    override fun versionFailed(error: VersionFailed) {
        versionFailures.add(error)
    }
}

class DocumentSessionTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = FakeClock()
    private val pdf: Path by lazy {
        folder.root
            .toPath()
            .resolve("Week 1.pdf")
            .also { Files.write(it, PDF_BYTES) }
    }
    private val inkFile: Path get() = pdf.resolveSibling("Week 1.pdf.ink.json")
    private val temporaryFile: Path get() = pdf.resolveSibling(".Week 1.pdf.ink.json.tmp")

    private fun stroke(
        id: String,
        page: Int = 0,
    ) = Stroke(
        StrokeId(id),
        PageId.ofPdfPage(page),
        Tool.PEN,
        PenColour.BLACK.argb,
        InkTool.Pen(PenColour.BLACK).widthPt,
        drawnAtMs = 1_760_000_000_000,
        points = listOf(StrokePoint(10f, 20f, 0.5f, 0), StrokePoint(11.25f, 22.5f, 0.75f, 9)),
    )

    private fun open(
        pageCount: Int = 3,
        listener: SaveListener = RecordingListener(),
    ) = DocumentSession.open(pdf, pageCount, clock, listener)

    @Test
    fun `a Document with no Ink file opens empty and writes nothing until there is ink`() {
        val session = open()
        clock.advance(10_000)
        session.saveNow()

        assertEquals(emptyList<Stroke>(), session.strokes)
        assertFalse(Files.exists(inkFile))
    }

    @Test
    fun `ink is saved 2 seconds after the last stroke and is all there on reopening`() {
        val session = open()
        session.addStroke(stroke("a"))
        clock.advance(1_500)
        session.addStroke(stroke("b", page = 2))
        clock.advance(1_999)
        assertFalse("saved before 2 s had passed since the last stroke", Files.exists(inkFile))

        clock.advance(1)

        assertEquals(SaveStatus.SAVED, session.status)
        assertEquals(listOf(stroke("a"), stroke("b", page = 2)), open().strokes)
    }

    @Test
    fun `going to the background saves at once`() {
        val session = open()
        session.addStroke(stroke("a"))

        session.saveNow()

        assertEquals(listOf(stroke("a")), open().strokes)
    }

    @Test
    fun `the PDF is never changed`() {
        val session = open()
        session.addStroke(stroke("a"))
        session.saveNow()

        assertArrayEquals(PDF_BYTES, Files.readAllBytes(pdf))
    }

    @Test
    fun `a stray temporary file from an interrupted save is ignored on open`() {
        open().apply {
            addStroke(stroke("a"))
            saveNow()
        }
        Files.writeString(temporaryFile, "{ half a fil")

        val session = open()

        assertEquals(listOf(stroke("a")), session.strokes)
        assertTrue(session.warnings.isEmpty())
        session.addStroke(stroke("b"))
        session.saveNow()
        assertEquals(listOf(stroke("a"), stroke("b")), open().strokes)
    }

    @Test
    fun `a failed save keeps the old file and the changes, shows Not saved, and retries until it works`() {
        val listener = RecordingListener()
        val session = open(listener = listener)
        session.addStroke(stroke("a"))
        session.saveNow()
        val before = Files.readAllBytes(inkFile)
        // A folder where the temporary file goes makes every write fail, as a full disk would.
        Files.createDirectory(temporaryFile)
        Files.writeString(temporaryFile.resolve("keep"), "x")

        session.addStroke(stroke("b"))
        clock.advance(2_000)

        assertEquals(SaveStatus.FAILED, session.status)
        assertArrayEquals(before, Files.readAllBytes(inkFile))
        assertEquals(listOf(stroke("a"), stroke("b")), session.strokes)
        assertEquals(1, listener.failures.size)

        clock.advance(DocumentSession.RETRY_DELAY_MS)
        assertEquals("still failing, so retried again", 2, listener.failures.size)
        assertEquals(SaveStatus.FAILED, session.status)

        temporaryFile.toFile().deleteRecursively()
        clock.advance(DocumentSession.RETRY_DELAY_MS)

        assertEquals(SaveStatus.SAVED, session.status)
        assertEquals(SaveStatus.SAVED, listener.statuses.last())
        assertEquals(listOf(stroke("a"), stroke("b")), open().strokes)
    }

    @Test
    fun `a damaged Ink file opens read-only with a warning and is never overwritten`() {
        val damaged = "{\"formatVersion\": 1, \"pdfPageCount\": 3, \"pages\": [{\"id\": \"pdf-1\"}], \"strokes\": [{"
        Files.writeString(inkFile, damaged)

        val session = open()

        assertTrue(session.readOnly)
        assertTrue(session.warnings.single() is SessionWarning.InkFileUnreadable)
        assertThrows(IllegalStateException::class.java) { session.addStroke(stroke("a")) }
        session.saveNow()
        clock.advance(60_000)
        assertEquals(damaged, Files.readString(inkFile))
    }

    @Test
    fun `a PDF whose page count changed since the ink was saved shows a warning`() {
        open(pageCount = 3).apply {
            addStroke(stroke("a"))
            saveNow()
        }

        assertEquals(listOf(SessionWarning.PdfPageCountChanged(3, 5)), open(pageCount = 5).warnings)
        assertEquals(emptyList<SessionWarning>(), open(pageCount = 3).warnings)
    }

    @Test
    fun `strokes keep their IDs and pages across a reopen`() {
        open(pageCount = 2).apply {
            addStroke(stroke("first", page = 1))
            saveNow()
        }

        val reopened = open(pageCount = 2).strokes.single()

        assertEquals(StrokeId("first"), reopened.id)
        assertEquals(PageId("pdf-2"), reopened.pageId)
    }

    @Test
    fun `a Notebook keeps its background through saves`() {
        Files.writeString(inkFile, InkFileCodec.encode(InkFile.empty(1).copy(notebook = PageBackground.GRID)))
        open(pageCount = 1).apply {
            assertEquals(PageBackground.GRID, notebook)
            addStroke(stroke("a"))
            saveNow()
        }

        assertEquals(PageBackground.GRID, open(pageCount = 1).notebook)
    }

    @Test
    fun `strokes hidden as not a mistake are saved, aren't an undo step and survive reopening`() {
        open().apply {
            addStroke(stroke("a"))
            hideNotMistakes(setOf(StrokeId("a"), StrokeId("erased later")))
            assertEquals(setOf(StrokeId("a"), StrokeId("erased later")), hiddenStrokes)
            assertTrue("only the stroke is an undo step", undo())
            assertFalse(canUndo)
            assertEquals(setOf(StrokeId("a"), StrokeId("erased later")), hiddenStrokes)
            saveNow()
        }

        assertEquals(setOf(StrokeId("a"), StrokeId("erased later")), open().hiddenStrokes)
    }

    @Test
    fun `an Ink file without hidden strokes opens with none hidden`() {
        Files.writeString(inkFile, InkFileCodec.encode(InkFile.empty(1)))
        assertEquals(emptySet<StrokeId>(), open(pageCount = 1).hiddenStrokes)
    }

    @Test
    fun `a Document that isn't a Notebook has no Notebook background`() {
        assertEquals(null, open().notebook)
    }

    @Test
    fun `erasing removes the strokes, and nothing else, as one undo step`() {
        val session = open()
        listOf("a", "b", "c").forEach { session.addStroke(stroke(it)) }

        session.eraseStrokes(setOf(StrokeId("a"), StrokeId("c"), StrokeId("gone already")))
        assertEquals(listOf(stroke("b")), session.strokes)

        assertTrue(session.undo())
        assertEquals("erased strokes come back in their places", listOf("a", "b", "c").map(::stroke), session.strokes)
        assertTrue(session.undo())
        assertEquals(listOf(stroke("a"), stroke("b")), session.strokes)
    }

    @Test
    fun `undo and redo step back and forward through adds and erases`() {
        val session = open()
        assertFalse(session.canUndo)
        session.addStroke(stroke("a"))
        session.addStroke(stroke("b"))
        session.eraseStrokes(setOf(StrokeId("a")))

        repeat(3) { assertTrue(session.undo()) }
        assertEquals(emptyList<Stroke>(), session.strokes)
        assertFalse("nothing left to undo", session.undo())
        assertTrue(session.canRedo)

        repeat(3) { assertTrue(session.redo()) }
        assertEquals(listOf(stroke("b")), session.strokes)
        assertFalse("nothing left to redo", session.redo())
        assertFalse(session.canRedo)
    }

    @Test
    fun `a new change after an undo drops what could have been redone`() {
        val session = open()
        session.addStroke(stroke("a"))
        session.undo()

        session.addStroke(stroke("b"))

        assertFalse(session.canRedo)
        assertEquals(listOf(stroke("b")), session.strokes)
    }

    @Test
    fun `erasing nothing is not an undo step`() {
        val session = open()
        session.addStroke(stroke("a"))

        session.eraseStrokes(setOf(StrokeId("not here")))
        session.undo()

        assertEquals(emptyList<Stroke>(), session.strokes)
    }

    @Test
    fun `erases, undos and redos are saved like any other change`() {
        val session = open()
        session.addStroke(stroke("a"))
        session.addStroke(stroke("b"))
        clock.advance(DocumentSession.SAVE_DELAY_MS)

        session.eraseStrokes(setOf(StrokeId("a")))
        assertEquals(SaveStatus.PENDING, session.status)
        clock.advance(DocumentSession.SAVE_DELAY_MS)
        assertEquals(listOf(stroke("b")), open().strokes)

        session.undo()
        clock.advance(DocumentSession.SAVE_DELAY_MS)
        assertEquals(listOf(stroke("a"), stroke("b")), open().strokes)

        session.redo()
        session.saveNow()
        assertEquals(listOf(stroke("b")), open().strokes)
    }

    @Test
    fun `moving a Lasso selection moves those strokes, and nothing else, as one undo step`() {
        val session = open()
        listOf("a", "b", "c").forEach { session.addStroke(stroke(it)) }
        val offset = PageOffset(30f, 120f)

        assertTrue(session.moveStrokes(setOf(StrokeId("a"), StrokeId("c"), StrokeId("gone already")), offset))
        assertEquals(listOf(stroke("a").movedBy(offset), stroke("b"), stroke("c").movedBy(offset)), session.strokes)

        assertTrue(session.undo())
        assertEquals("exactly where they were", listOf("a", "b", "c").map(::stroke), session.strokes)
        assertTrue(session.redo())
        assertEquals(listOf(stroke("a").movedBy(offset), stroke("b"), stroke("c").movedBy(offset)), session.strokes)
    }

    @Test
    fun `moving nothing, or by nothing, is not an undo step`() {
        val session = open()
        session.addStroke(stroke("a"))

        assertFalse(session.moveStrokes(setOf(StrokeId("not here")), PageOffset(10f, 10f)))
        assertFalse(session.moveStrokes(setOf(StrokeId("a")), PageOffset(0f, 0f)))
        session.undo()

        assertEquals(emptyList<Stroke>(), session.strokes)
    }

    @Test
    fun `Lasso moves and deletes, and their undos, are saved like any other change`() {
        val session = open()
        session.addStroke(stroke("a"))
        session.addStroke(stroke("b"))
        val offset = PageOffset(0f, 200f)

        session.moveStrokes(setOf(StrokeId("a"), StrokeId("b")), offset)
        clock.advance(DocumentSession.SAVE_DELAY_MS)
        assertEquals(listOf(stroke("a").movedBy(offset), stroke("b").movedBy(offset)), open().strokes)

        session.eraseStrokes(setOf(StrokeId("a"), StrokeId("b")))
        clock.advance(DocumentSession.SAVE_DELAY_MS)
        assertEquals(emptyList<Stroke>(), open().strokes)

        session.undo()
        clock.advance(DocumentSession.SAVE_DELAY_MS)
        assertEquals(listOf(stroke("a").movedBy(offset), stroke("b").movedBy(offset)), open().strokes)

        session.undo()
        session.saveNow()
        assertEquals(listOf(stroke("a"), stroke("b")), open().strokes)
    }

    @Test
    fun `a read-only Document can't be erased, and has nothing to undo`() {
        Files.writeString(inkFile, "{")
        val session = open()

        assertThrows(IllegalStateException::class.java) { session.eraseStrokes(setOf(StrokeId("a"))) }
        assertThrows(
            IllegalStateException::class.java,
        ) { session.moveStrokes(setOf(StrokeId("a")), PageOffset(1f, 1f)) }
        assertFalse(session.undo())
    }

    private val versionsFolder: Path get() = pdf.resolveSibling(".versions")

    private fun versions(): List<String> =
        if (!Files.exists(versionsFolder)) {
            emptyList()
        } else {
            Files.list(versionsFolder).use { files -> files.map { it.fileName.toString() }.sorted().toList() }
        }

    private fun saveOneStroke(id: String) =
        open().apply {
            addStroke(stroke(id))
            saveNow()
        }

    @Test
    fun `opening a Document with an Ink file takes a Version of it before any change`() {
        saveOneStroke("a")
        val before = Files.readAllBytes(inkFile)
        assertEquals(emptyList<String>(), versions())

        clock.advance(1_000)
        open()

        assertEquals(listOf("Week 1.pdf.ink.json.1000.version"), versions())
        assertArrayEquals(before, Files.readAllBytes(versionsFolder.resolve(versions().single())))
    }

    @Test
    fun `no Version is taken of a Document with no Ink file or a damaged one`() {
        open()
        Files.writeString(inkFile, "{")
        open()

        assertEquals(emptyList<String>(), versions())
    }

    @Test
    fun `while writing, a Version is taken at most every 15 minutes`() {
        saveOneStroke("a")
        val session = open()
        val minute = 60_000L
        repeat(40) { i ->
            session.addStroke(stroke("m$i"))
            clock.advance(minute)
        }

        // On open (0), then at the first save at least 15 minutes after the last Version: 15:02, 30:02.
        assertEquals(
            listOf(0L, 15 * minute + 2_000, 30 * minute + 2_000).map { "Week 1.pdf.ink.json.$it.version" }.sorted(),
            versions(),
        )
    }

    @Test
    fun `a Version taken while writing holds the Ink file as it was before that save`() {
        saveOneStroke("a")
        val session = open()
        clock.advance(DocumentSession.VERSION_INTERVAL_MS)
        session.addStroke(stroke("b"))
        val beforeSave = Files.readAllBytes(inkFile)

        session.saveNow()

        assertArrayEquals(beforeSave, Files.readAllBytes(versionsFolder.resolve(versions().last())))
    }

    @Test
    fun `only the newest 10 Versions of a Document are kept, and other Documents' Versions are left alone`() {
        Files.createDirectories(versionsFolder)
        Files.writeString(versionsFolder.resolve("Week 2.pdf.ink.json.5.version"), "other")
        saveOneStroke("a")

        repeat(12) {
            clock.advance(1_000)
            open()
        }

        val ours = versions().filter { it.startsWith("Week 1.pdf.") }
        assertEquals((3..12).map { "Week 1.pdf.ink.json.${it * 1_000}.version" }.sorted(), ours)
        assertTrue(Files.exists(versionsFolder.resolve("Week 2.pdf.ink.json.5.version")))
    }

    @Test
    fun `a Version that can't be written is reported and doesn't stop the Document opening`() {
        saveOneStroke("a")
        Files.writeString(versionsFolder, "a file where the folder should be")
        val listener = RecordingListener()

        val session = open(listener = listener)

        assertFalse(session.readOnly)
        assertEquals(1, listener.versionFailures.size)
    }

    private companion object {
        val PDF_BYTES = "%PDF-1.7 not really".toByteArray()
    }
}
