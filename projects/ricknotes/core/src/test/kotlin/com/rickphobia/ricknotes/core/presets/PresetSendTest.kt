package com.rickphobia.ricknotes.core.presets

import com.rickphobia.ricknotes.core.export.ExportPage
import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.inkfile.InkPage
import com.rickphobia.ricknotes.core.session.DocumentSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PresetSendTest {
    private val hint = Preset("Hint", "Give me one hint.", inkOn = true)
    private val overview = Preset("Chapter overview", "Give me an overview.", inkOn = false)

    private fun snapshot(
        strokesOnPage: Int? = 0,
        inkUnreadable: Boolean = false,
        conflictWaiting: Boolean = false,
    ): DocumentSnapshot {
        val pages = List(2) { InkPage(PageId.ofPdfPage(it)) }
        val pen = InkTool.Pen(PenColour.BLACK)
        val strokes =
            listOfNotNull(strokesOnPage).map { index ->
                Stroke(
                    StrokeId("s$index"),
                    PageId.ofPdfPage(index),
                    pen.tool,
                    pen.colourArgb,
                    pen.widthPt,
                    drawnAtMs = 1_760_000_000_000,
                    points = listOf(StrokePoint(10f, 20f, 0.5f, 0), StrokePoint(30f, 40f, 0.6f, 12)),
                )
            }
        return DocumentSnapshot(2, pages, strokes, emptyList(), inkUnreadable, conflictWaiting)
    }

    private fun ready(send: PresetSend): PresetSend.Ready {
        assertTrue("expected Ready, was $send", send is PresetSend.Ready)
        return send as PresetSend.Ready
    }

    @Test
    fun `an ink-on Preset sends the Export of a Document with ink`() {
        val send = ready(PresetSend.of(hint, listOf(snapshot())))

        val only = send.documents.single() as DocumentSend.WithInk
        assertEquals(1, only.plan.strokeCount)
        assertTrue(send.inkGoes)
        assertFalse(send.inkLeftOut)
    }

    @Test
    fun `an ink-off Preset sends the bare PDF even with ink`() {
        val send = ready(PresetSend.of(overview, listOf(snapshot())))

        assertEquals(listOf(DocumentSend.Bare()), send.documents)
        assertFalse(send.inkGoes)
    }

    @Test
    fun `an ink-on Preset on a Document with no ink sends the bare PDF`() {
        val send = ready(PresetSend.of(hint, listOf(snapshot(strokesOnPage = null))))

        assertEquals(listOf(DocumentSend.Bare()), send.documents)
    }

    @Test
    fun `Both Panes gets one plan per Document, each with its own ink, in order`() {
        val send = ready(PresetSend.of(hint, listOf(snapshot(strokesOnPage = 1), snapshot(strokesOnPage = 0))))

        val pages =
            send.documents.map { document ->
                (document as DocumentSend.WithInk).plan.pages.indexOfFirst { it.strokes.isNotEmpty() }
            }
        assertEquals(listOf(1, 0), pages)
        assertTrue(send.documents.all { (it as DocumentSend.WithInk).plan.pages.all { p -> p is ExportPage.FromPdf } })
    }

    @Test
    fun `Both Panes sends a Document without ink bare beside one with ink`() {
        val send = ready(PresetSend.of(hint, listOf(snapshot(strokesOnPage = null), snapshot())))

        assertEquals(DocumentSend.Bare(), send.documents[0])
        assertTrue(send.documents[1] is DocumentSend.WithInk)
    }

    @Test
    fun `an unreadable Ink file sends the bare PDF and says the ink was left out`() {
        val send = ready(PresetSend.of(hint, listOf(snapshot(inkUnreadable = true))))

        assertEquals(listOf(DocumentSend.Bare(inkLeftOut = true)), send.documents)
        assertTrue(send.inkLeftOut)
    }

    @Test
    fun `an unreadable Ink file goes unremarked by an ink-off Preset`() {
        val send = ready(PresetSend.of(overview, listOf(snapshot(inkUnreadable = true))))

        assertFalse(send.inkLeftOut)
    }

    @Test
    fun `a Document whose ink hasn't loaded goes bare, noted only when ink was wanted`() {
        val withInk = ready(PresetSend.of(hint, listOf(snapshot(), null)))
        val noInk = ready(PresetSend.of(overview, listOf(snapshot(), null)))

        assertEquals(DocumentSend.Bare(inkLeftOut = true), withInk.documents[1])
        assertTrue(withInk.documents[0] is DocumentSend.WithInk)
        assertEquals(listOf(DocumentSend.Bare(), DocumentSend.Bare()), noInk.documents)
    }

    @Test
    fun `a waiting Conflict copy on either Document asks for a side first`() {
        assertEquals(PresetSend.PickASideFirst, PresetSend.of(hint, listOf(snapshot(conflictWaiting = true))))
        assertEquals(
            PresetSend.PickASideFirst,
            PresetSend.of(hint, listOf(snapshot(), snapshot(conflictWaiting = true))),
        )
    }

    @Test
    fun `an ink-off Preset sends even with a Conflict copy waiting`() {
        val send = ready(PresetSend.of(overview, listOf(snapshot(conflictWaiting = true))))

        assertEquals(listOf(DocumentSend.Bare()), send.documents)
    }
}
