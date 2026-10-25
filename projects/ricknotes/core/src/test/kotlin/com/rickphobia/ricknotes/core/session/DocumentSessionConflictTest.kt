package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.Tool
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

class DocumentSessionConflictTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = FakeClock()
    private val pdf: Path by lazy {
        folder
            .newFolder("EE2001")
            .toPath()
            .resolve("Week 1.pdf")
            .also { Files.write(it, "%PDF-1.7 not really".toByteArray()) }
    }
    private val inkFile: Path get() = pdf.resolveSibling("Week 1.pdf.ink.json")
    private val conflictCopy: Path get() = pdf.resolveSibling(COPY_NAME)
    private val versionsFolder: Path get() = pdf.resolveSibling(".versions")

    private fun stroke(id: String) =
        Stroke(
            StrokeId(id),
            PageId.ofPdfPage(0),
            Tool.PEN,
            PenColour.BLACK.argb,
            InkTool.Pen(PenColour.BLACK).widthPt,
            drawnAtMs = 1_760_000_000_000,
            points = listOf(StrokePoint(10f, 20f, 0.5f, 0), StrokePoint(11.25f, 22.5f, 0.75f, 9)),
        )

    private fun open() = DocumentSession.open(pdf, 3, clock)

    // Writes an Ink file holding one stroke [id], as a save on this tablet would.
    private fun saveInk(id: String) =
        open().apply {
            addStroke(stroke(id))
            saveNow()
        }

    // Mine holds stroke "mine" and the sync app's copy holds stroke "theirs"; no Versions yet.
    private fun conflict() {
        saveInk("theirs")
        val theirs = folder.root.toPath().resolve("theirs.json")
        Files.move(inkFile, theirs)
        saveInk("mine")
        Files.move(theirs, conflictCopy)
        assertEquals(emptyList<Path>(), versions())
    }

    private fun versions(): List<Path> =
        if (Files.isDirectory(versionsFolder)) Files.list(versionsFolder).use { it.sorted().toList() } else emptyList()

    private fun files(): List<String> =
        Files.list(pdf.parent).use { s ->
            s
                .map {
                    it.fileName.toString()
                }.sorted()
                .toList()
        }

    @Test
    fun `a Conflict copy of the Ink file is found on open and nothing can be written until it is resolved`() {
        conflict()

        val session = open()

        assertEquals(COPY_NAME, session.conflictCopy)
        assertTrue(session.readOnly)
        assertEquals(listOf("mine"), session.strokes.map { it.id.value })
        assertThrows(IllegalStateException::class.java) { session.addStroke(stroke("new")) }
    }

    @Test
    fun `the Ink file, its temporary file, its assets and other Documents' files are not Conflict copies`() {
        saveInk("mine")
        Files.write(pdf.resolveSibling(".Week 1.pdf.ink.json.tmp"), "half".toByteArray())
        Files.createDirectories(pdf.resolveSibling("Week 1.pdf.assets"))
        Files.write(pdf.resolveSibling("Week 10.pdf.ink.json"), "{}".toByteArray())
        Files.write(pdf.resolveSibling("Week 1.pdf.ink.pdf"), "%PDF".toByteArray())
        Files.write(pdf.resolveSibling("Week 1.pdf.ink.pdf.ink.json"), "{}".toByteArray())

        val session = open()

        assertNull(session.conflictCopy)
        assertFalse(session.readOnly)
    }

    @Test
    fun `Keep mine moves the Conflict copy into Versions and keeps writing to mine`() {
        conflict()
        val theirs = Files.readAllBytes(conflictCopy)
        val mine = Files.readAllBytes(inkFile)
        val session = open()

        clock.advance(10)
        session.keepMine()

        assertNull(session.conflictCopy)
        assertFalse(session.readOnly)
        assertFalse(Files.exists(conflictCopy))
        assertArrayEquals(mine, Files.readAllBytes(inkFile))
        // The Version taken on open (mine) and the moved Conflict copy (theirs): nothing deleted.
        assertEquals(listOf(mine.toList(), theirs.toList()), versions().map { Files.readAllBytes(it).toList() })
        session.addStroke(stroke("new"))
        session.saveNow()
        assertEquals(listOf("mine", "new"), open().strokes.map { it.id.value })
    }

    @Test
    fun `Keep the other puts the Conflict copy in place of the Ink file and moves mine into Versions`() {
        conflict()
        val theirs = Files.readAllBytes(conflictCopy)
        val mine = Files.readAllBytes(inkFile)
        val session = open()

        clock.advance(10)
        session.keepTheOther()

        assertNull(session.conflictCopy)
        assertFalse(session.readOnly)
        assertEquals(listOf("theirs"), session.strokes.map { it.id.value })
        assertFalse(Files.exists(conflictCopy))
        assertArrayEquals(theirs, Files.readAllBytes(inkFile))
        assertTrue(versions().map { Files.readAllBytes(it).toList() }.contains(mine.toList()))
        assertEquals(listOf("Week 1.pdf", "Week 1.pdf.ink.json"), files().filter { !it.startsWith(".") })
        session.addStroke(stroke("new"))
        session.saveNow()
        assertEquals(listOf("theirs", "new"), open().strokes.map { it.id.value })
    }

    @Test
    fun `a Version taken in the same millisecond as the open never replaces the open's Version`() {
        conflict()
        val session = open()

        session.keepMine()

        assertEquals(2, versions().size)
    }

    @Test
    fun `a damaged Conflict copy can't be kept, and nothing is moved`() {
        conflict()
        Files.write(conflictCopy, "not json".toByteArray())
        val session = open()
        val before = files()
        val versionsBefore = versions()

        val error = assertThrows(ConflictNotResolved::class.java) { session.keepTheOther() }

        assertEquals(COPY_NAME, error.copyName)
        assertEquals(before, files())
        assertEquals(versionsBefore, versions())
        assertEquals(COPY_NAME, session.conflictCopy)
        assertEquals(listOf("mine"), session.strokes.map { it.id.value })
    }

    @Test
    fun `with two Conflict copies, each is resolved in turn`() {
        conflict()
        val second = pdf.resolveSibling("Week 1.pdf.ink (2).json")
        Files.copy(conflictCopy, second)
        val session = open()

        session.keepMine()
        assertEquals("Week 1.pdf.ink (2).json", session.conflictCopy)
        assertTrue(session.readOnly)
        clock.advance(1)
        session.keepTheOther()

        assertNull(session.conflictCopy)
        assertEquals(listOf("theirs"), session.strokes.map { it.id.value })
    }

    private companion object {
        // The ticket's guess at FolderSync's naming; see the README's "Sync app" section.
        const val COPY_NAME = "Week 1.pdf.ink (1).json"
    }
}
