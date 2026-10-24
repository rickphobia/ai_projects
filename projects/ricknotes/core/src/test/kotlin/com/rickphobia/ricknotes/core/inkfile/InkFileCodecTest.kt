package com.rickphobia.ricknotes.core.inkfile

import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.PictureId
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.Tool
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class InkFileCodecTest {
    private val points =
        listOf(
            StrokePoint(x = 72.5f, y = 100.25f, pressure = 0.4f, elapsedMs = 0),
            StrokePoint(x = 73.01f, y = 99.99f, pressure = 0.512f, elapsedMs = 8),
            StrokePoint(x = 0f, y = 841.89f, pressure = 1f, elapsedMs = 16),
        )
    private val file =
        InkFile(
            pdfPageCount = 2,
            pages = InkFile.pdfPages(2),
            strokes =
                listOf(
                    Stroke(StrokeId("a"), PageId("pdf-1"), Tool.PEN, 0xFF000000.toInt(), 1.5f, DRAWN_AT, points),
                    Stroke(StrokeId("b"), PageId("pdf-2"), Tool.HIGHLIGHTER, 0x80FFEB3B.toInt(), 12f, DRAWN_AT, points),
                ),
            pictures = listOf(Picture(PictureId("p"), PageId("pdf-2"), "p.png", 10.5f, 20f, 300f, 150.25f)),
        )

    @Test
    fun `an Ink file round-trips exactly, packed points and Pictures included`() {
        val text = InkFileCodec.encode(file)

        assertEquals(file, InkFileCodec.decode(text, "a.pdf.ink.json"))
        assertEquals(text, InkFileCodec.encode(InkFileCodec.decode(text, "a.pdf.ink.json")))
    }

    @Test
    fun `the file is readable JSON with the format version, page count, pages, stroke and Picture details`() {
        val text = InkFileCodec.encode(file)

        listOf(
            "\"formatVersion\": 3",
            "\"pdfPageCount\": 2",
            "\"id\": \"pdf-1\"",
            "\"tool\": \"highlighter\"",
            "\"colour\": \"#80FFEB3B\"",
            "\"image\": \"p.png\"",
            "\"widthPt\": 300.0",
        ).forEach { assertTrue("missing $it in\n$text", text.contains(it)) }
    }

    @Test
    fun `an Ink file written before Pictures opens with none`() {
        val version1 =
            """
            {"formatVersion": 1, "pdfPageCount": 1, "pages": [{"id": "pdf-1"}], "strokes": [
              {"id": "a", "page": "pdf-1", "tool": "pen", "colour": "#FF000000", "widthPt": 1.5,
               "drawnAtMs": 1760000000000, "points": "7250,10025,400,0"}
            ]}
            """.trimIndent()

        val read = InkFileCodec.decode(version1, "a.pdf.ink.json")

        assertEquals(emptyList<Picture>(), read.pictures)
        assertEquals(StrokeId("a"), read.strokes.single().id)
    }

    @Test
    fun `an Inserted page round-trips with its background, and a PDF page is written with none`() {
        val inserted = InkPage(PageId("inserted-1"), PageBackground.GRID)
        val withInserted = file.copy(pages = listOf(file.pages[0], inserted, file.pages[1]))

        val text = InkFileCodec.encode(withInserted)

        assertEquals(withInserted, InkFileCodec.decode(text, "a.pdf.ink.json"))
        assertTrue(text, text.contains("\"id\": \"inserted-1\",\n            \"background\": \"grid\""))
        assertTrue(text, text.contains("\"id\": \"pdf-1\"\n"))
    }

    @Test
    fun `an Ink file written before Inserted pages opens unchanged`() {
        val version2 =
            """
            {"formatVersion": 2, "pdfPageCount": 2, "pages": [{"id": "pdf-1"}, {"id": "pdf-2"}], "strokes": [
              {"id": "a", "page": "pdf-2", "tool": "pen", "colour": "#FF000000", "widthPt": 1.5,
               "drawnAtMs": 1760000000000, "points": "7250,10025,400,0"}
            ], "pictures": []}
            """.trimIndent()

        val read = InkFileCodec.decode(version2, "a.pdf.ink.json")

        assertEquals(InkFile.pdfPages(2), read.pages)
        assertEquals(PageId("pdf-2"), read.strokes.single().pageId)
    }

    @Test
    fun `a Notebook's background round-trips, and other Documents have none`() {
        val notebook = file.copy(notebook = PageBackground.DOTTED)

        val text = InkFileCodec.encode(notebook)

        assertEquals(notebook, InkFileCodec.decode(text, "a.pdf.ink.json"))
        assertTrue(text, text.contains("\"notebook\": \"dotted\""))
        assertEquals(null, InkFileCodec.decode(InkFileCodec.encode(file), "a.pdf.ink.json").notebook)
    }

    @Test
    fun `an unknown Notebook background is reported as damaged`() {
        val text = InkFileCodec.encode(file.copy(notebook = PageBackground.LINED)).replace("\"lined\"", "\"music\"")

        assertThrows(InkFileDamaged::class.java) { InkFileCodec.decode(text, "a.pdf.ink.json") }
    }

    @Test
    fun `an unknown background is reported as damaged`() {
        val text =
            InkFileCodec
                .encode(file.copy(pages = file.pages + InkPage(PageId("inserted-1"), PageBackground.LINED)))
                .replace("\"lined\"", "\"music\"")

        assertThrows(InkFileDamaged::class.java) { InkFileCodec.decode(text, "a.pdf.ink.json") }
    }

    @Test
    fun `points are difference-encoded whole numbers in text`() {
        val text = InkFileCodec.encode(file)

        assertTrue(text, text.contains("\"points\": \"7250,10025,400,0,51,-26,112,8,-7301,74190,488,8\""))
    }

    @Test
    fun `a point off the stored grid comes back within half a step`() {
        val fine = StrokePoint(x = 10.123456f, y = 5.006f, pressure = 0.33333f, elapsedMs = 3)

        val back = PointPacking.unpack(PointPacking.pack(listOf(fine))).single()

        assertTrue(abs(back.x - fine.x) <= 0.005f && abs(back.y - fine.y) <= 0.005f)
        assertTrue(abs(back.pressure - fine.pressure) <= 0.0005f)
    }

    @Test
    fun `text that isn't an Ink file is reported as damaged`() {
        listOf(
            "",
            "{\"formatVersion\": 1",
            "{\"formatVersion\": 1, \"pdfPageCount\": 1, \"pages\": []}",
        ).forEach { text ->
            assertThrows(InkFileDamaged::class.java) { InkFileCodec.decode(text, "a.pdf.ink.json") }
        }
    }

    @Test
    fun `bad points, an unknown page, a bad Picture or a newer format version are reported as damaged`() {
        val good = InkFileCodec.encode(file)
        listOf(
            good.replace("7250,10025,400,0,51", "7250,10025,400,0,x"),
            good.replace("7250,10025,400,0,51,-26,112,8,", "7250,10025,400,0,51,-26,"),
            good.replace("\"page\": \"pdf-2\"", "\"page\": \"pdf-9\""),
            good.replace("\"formatVersion\": 3", "\"formatVersion\": 4"),
            """{"formatVersion": 3, "pdfPageCount": 1, "pages": [{"id": "pdf-1"}, {"id": "pdf-1"}], "strokes": []}""",
            good.replace("\"page\": \"pdf-2\",\n            \"image\"", "\"page\": \"pdf-9\",\n            \"image\""),
            good.replace("\"image\": \"p.png\"", "\"image\": \"../p.png\""),
            good.replace("\"heightPt\": 150.25", "\"heightPt\": 0.0"),
        ).forEach { text ->
            assertThrows(text, InkFileDamaged::class.java) { InkFileCodec.decode(text, "a.pdf.ink.json") }
        }
    }

    private companion object {
        const val DRAWN_AT = 1_760_000_000_000
    }
}
