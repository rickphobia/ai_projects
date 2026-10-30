package com.rickphobia.ricknotes.core.logpdf

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.EntryId
import com.rickphobia.ricknotes.core.revisionlog.EntryKind
import com.rickphobia.ricknotes.core.revisionlog.EntrySource
import com.rickphobia.ricknotes.core.revisionlog.Schedule
import com.rickphobia.ricknotes.core.session.PageRect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class LogPdfLayoutTest {
    private val margin = 36f
    private val bottom = LogPdfLayout.PAGE_HEIGHT_PT - LogPdfLayout.MARGIN_PT

    private fun entry(
        id: String,
        area: PageRect = PageRect(0f, 0f, 200f, 100f),
        box: PageRect? = null,
        kind: EntryKind = EntryKind.MISTAKE,
        addedAtMs: Long = 0,
    ) = Entry(
        EntryId(id),
        kind,
        EntrySource("Y1/Sem1/EE2001/tut1.pdf", PageId.ofPdfPage(0), 1, area),
        addedAtMs,
        Schedule(LocalDate.of(2026, 10, 30), 3),
        box = box,
    )

    // A Snip of [entry]'s area at 2 pixels per point.
    private fun withSnip(entry: Entry) =
        ExportedEntry(
            entry,
            SnipSize(
                ((entry.source.area.right - entry.source.area.left) * 2).toInt(),
                ((entry.source.area.bottom - entry.source.area.top) * 2).toInt(),
            ),
        )

    private fun pages(vararg entries: ExportedEntry) = LogPdfLayout.pages(entries.toList(), margin)

    @Test
    fun `a wide Snip fills the printable width and keeps its shape`() {
        val placed = pages(withSnip(entry("a"))).single().entries.single()

        val snip = placed.snip!!
        assertEquals(LogPdfLayout.PRINTABLE_WIDTH_PT, snip.width, 0.01f)
        assertEquals(LogPdfLayout.PRINTABLE_WIDTH_PT / 2, snip.height, 0.01f)
        assertEquals(LogPdfLayout.MARGIN_PT, placed.text.top, 0.01f)
        assertEquals(placed.text.bottom, snip.top, 0.01f)
        assertEquals(SnipCrop(0, 0, 400, 200), placed.crop)
    }

    @Test
    fun `a tall Snip is capped at half the printable height`() {
        val tall = entry("a", area = PageRect(0f, 0f, 100f, 800f))

        val snip =
            pages(withSnip(tall))
                .single()
                .entries
                .single()
                .snip!!

        assertEquals(LogPdfLayout.MAX_SNIP_HEIGHT_PT, snip.height, 0.01f)
        assertEquals(LogPdfLayout.PRINTABLE_HEIGHT_PT / 2, LogPdfLayout.MAX_SNIP_HEIGHT_PT, 0.01f)
        assertEquals(LogPdfLayout.MAX_SNIP_HEIGHT_PT / 8, snip.width, 0.01f)
    }

    @Test
    fun `Entries fill a page and the one that doesn't fit starts the next page`() {
        // Each Entry is a text block and a Snip a quarter of the printable width high.
        val entries = (1..6).map { withSnip(entry("e$it", area = PageRect(0f, 0f, 400f, 100f))) }
        val entryHeight = LogPdfLayout.TEXT_BLOCK_HEIGHT_PT + LogPdfLayout.PRINTABLE_WIDTH_PT / 4
        val perPage =
            (
                (LogPdfLayout.PRINTABLE_HEIGHT_PT + LogPdfLayout.ENTRY_GAP_PT) /
                    (entryHeight + LogPdfLayout.ENTRY_GAP_PT)
            ).toInt()

        val result = pages(*entries.toTypedArray())

        assertEquals(perPage, result.first().entries.size)
        assertEquals(entries.map { it.entry.id }, result.flatMap { page -> page.entries.map { it.entry.id } })
        assertEquals(
            LogPdfLayout.MARGIN_PT,
            result[1]
                .entries
                .first()
                .text.top,
            0.01f,
        )
    }

    @Test
    fun `no Entry is split across two pages`() {
        val sizes = listOf(100f, 700f, 300f, 800f, 50f, 600f, 400f, 900f)
        val entries = sizes.mapIndexed { i, height -> withSnip(entry("e$i", area = PageRect(0f, 0f, 300f, height))) }

        val result = pages(*entries.toTypedArray())

        result.forEach { page ->
            page.entries.forEach { placed ->
                val end = placed.snip?.bottom ?: placed.text.bottom
                assertTrue("${placed.entry.id} ends at $end, past $bottom", end <= bottom + 0.01f)
                assertTrue(placed.text.top >= LogPdfLayout.MARGIN_PT - 0.01f)
            }
            page.entries.zipWithNext().forEach { (above, below) ->
                assertTrue(below.text.top >= above.snip!!.bottom + LogPdfLayout.ENTRY_GAP_PT - 0.01f)
            }
        }
        assertEquals(sizes.size, result.sumOf { it.entries.size })
    }

    @Test
    fun `an Entry with a box is cropped to the box with the on-screen margin`() {
        // A whole A4 page, as for an Entry from a Red mark, with a box near its top-left corner.
        val page = PageRect(0f, 0f, 595f, 842f)
        val boxed = entry("a", area = page, box = PageRect(100f, 50f, 300f, 150f))

        val placed = pages(withSnip(boxed)).single().entries.single()

        // Grown by 36 pt each way, at 2 pixels per point.
        assertEquals(SnipCrop(128, 28, 672, 372), placed.crop)
        val snip = placed.snip!!
        assertEquals(snip.width / snip.height, 544f / 344f, 0.001f)
    }

    @Test
    fun `a box past the edge of the Snip is cut to it`() {
        val boxed = entry("a", area = PageRect(0f, 0f, 595f, 842f), box = PageRect(10f, 10f, 100f, 100f))

        val placed = pages(withSnip(boxed)).single().entries.single()

        assertEquals(SnipCrop(0, 0, 272, 272), placed.crop)
    }

    @Test
    fun `an Entry without a box shows its whole Snip`() {
        val placed = pages(withSnip(entry("a", area = PageRect(50f, 60f, 150f, 110f)))).single().entries.single()

        assertEquals(SnipCrop(0, 0, 200, 100), placed.crop)
    }

    @Test
    fun `an Entry whose Snip can't be read still gets its text`() {
        val missing = ExportedEntry(entry("a"), snip = null)

        val placed = pages(missing, withSnip(entry("b"))).single().entries

        assertNull(placed[0].crop)
        assertNull(placed[0].snip)
        assertEquals(placed[0].text.bottom + LogPdfLayout.ENTRY_GAP_PT, placed[1].text.top, 0.01f)
    }

    @Test
    fun `the Entries keep the order and filter they are given`() {
        val keyPoints =
            listOf(
                entry("new", kind = EntryKind.KEY_POINT, addedAtMs = 300),
                entry("old", kind = EntryKind.KEY_POINT, addedAtMs = 100),
            )

        val result = pages(*keyPoints.map { withSnip(it) }.toTypedArray())

        assertEquals(keyPoints, result.flatMap { page -> page.entries.map { it.entry } })
    }

    @Test
    fun `an empty list is refused`() {
        assertThrows(NothingToExport::class.java) { LogPdfLayout.pages(emptyList(), margin) }
    }
}
