package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.inkfile.InkPage

/**
 * A Document session's ink at one moment, read in one go, so ink written afterwards is not half in
 * it (spec, export with ink, story 10). [pdfPageCount] is the PDF's page count now; [pages] may still
 * list pages it no longer has, when the PDF changed after its ink was saved.
 */
data class DocumentSnapshot(
    val pdfPageCount: Int,
    val pages: List<InkPage>,
    val strokes: List<Stroke>,
    val pictures: List<Picture>,
    val inkUnreadable: Boolean,
    val conflictWaiting: Boolean,
)
