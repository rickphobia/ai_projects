package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.PictureFrame
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.Tool
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

class DocumentSessionPicturesTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = FakeClock()
    private val pdf: Path by lazy {
        folder.root
            .toPath()
            .resolve("tuto3.pdf")
            .also { Files.write(it, "%PDF-1.7 not really".toByteArray()) }
    }
    private val inkFile: Path get() = pdf.resolveSibling("tuto3.pdf.ink.json")
    private val assets: Path get() = pdf.resolveSibling("tuto3.pdf.assets")

    // A screenshot somewhere outside the Study folder, as the app's drop adapter leaves it.
    private val screenshot: Path by lazy {
        folder.newFolder("cache").toPath().resolve("drop.png").also { Files.write(it, IMAGE_BYTES) }
    }

    private val frame = PictureFrame(left = 50f, top = 100f, widthPt = 300f, heightPt = 150f)

    private fun open() = DocumentSession.open(pdf, 3, clock)

    private fun DocumentSession.place(page: Int = 0) =
        placePicture(screenshot, "png", PageId.ofPdfPage(page), frame)

    private fun stroke(id: String) =
        Stroke(
            StrokeId(id),
            PageId.ofPdfPage(0),
            Tool.PEN,
            PenColour.BLACK.argb,
            InkTool.Pen(PenColour.BLACK).widthPt,
            drawnAtMs = 1_760_000_000_000,
            points = listOf(StrokePoint(10f, 20f, 0.5f, 0)),
        )

    @Test
    fun `a placed Picture is copied into assets, saved, and there on reopening`() {
        val session = open()

        val picture = session.place(page = 1)
        clock.advance(DocumentSession.SAVE_DELAY_MS)

        assertEquals(PageId("pdf-2"), picture.pageId)
        assertEquals(PictureFrame(picture.left, picture.top, picture.widthPt, picture.heightPt), frame)
        assertTrue(picture.imageFile.endsWith(".png"))
        assertEquals(assets, session.assetsFolder)
        assertArrayEquals(IMAGE_BYTES, Files.readAllBytes(assets.resolve(picture.imageFile)))
        assertEquals(listOf(picture), open().pictures)
    }

    @Test
    fun `the image is in assets before the Ink file refers to it`() {
        val session = open()

        val picture = session.place()

        assertFalse("not saved yet", Files.exists(inkFile))
        assertTrue(Files.exists(assets.resolve(picture.imageFile)))
    }

    @Test
    fun `the dropped file is never changed or moved`() {
        open().apply {
            place()
            saveNow()
        }

        assertArrayEquals(IMAGE_BYTES, Files.readAllBytes(screenshot))
    }

    @Test
    fun `each Picture gets an image of its own, even from the same file`() {
        val session = open()

        val first = session.place()
        val second = session.place()

        assertTrue(first.imageFile != second.imageFile && first.id != second.id)
        assertEquals(2, Files.list(assets).use { it.count() })
    }

    @Test
    fun `placing is one undo step in the same history as strokes, and undo keeps the image`() {
        val session = open()
        session.addStroke(stroke("a"))
        val picture = session.place()

        assertTrue(session.undo())
        assertEquals(emptyList<Picture>(), session.pictures)
        assertEquals(listOf(stroke("a")), session.strokes)
        assertTrue("undo keeps the image for redo", Files.exists(assets.resolve(picture.imageFile)))

        assertTrue(session.undo())
        assertEquals(emptyList<Stroke>(), session.strokes)

        assertTrue(session.redo())
        assertTrue(session.redo())
        assertEquals(listOf(picture), session.pictures)
        session.saveNow()
        assertEquals(listOf(picture), open().pictures)
    }

    @Test
    fun `an image that can't be copied places nothing and is reported`() {
        val session = open()
        // A file where the folder should be makes the copy fail, as a full disk would.
        Files.writeString(assets, "not a folder")

        assertThrows(PictureNotPlaced::class.java) { session.place() }
        assertEquals(emptyList<Picture>(), session.pictures)
        assertFalse(session.canUndo)
        assertEquals(SaveStatus.SAVED, session.status)
    }

    @Test
    fun `a read-only Document takes no Pictures`() {
        Files.writeString(inkFile, "{ damaged")
        val session = open()

        assertThrows(IllegalStateException::class.java) { session.place() }
        assertFalse(Files.exists(assets))
    }

    private companion object {
        val IMAGE_BYTES = byteArrayOf(0x89.toByte(), 'P'.code.toByte(), 'N'.code.toByte(), 'G'.code.toByte(), 1, 2, 3)
    }
}
