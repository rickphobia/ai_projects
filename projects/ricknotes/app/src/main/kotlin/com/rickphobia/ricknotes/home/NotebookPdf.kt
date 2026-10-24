package com.rickphobia.ricknotes.home

import android.graphics.pdf.PdfDocument
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.Paper
import com.rickphobia.ricknotes.viewer.PageSize
import com.rickphobia.ricknotes.viewer.drawPaper
import java.io.FileOutputStream
import java.nio.file.Path

/**
 * Writes a Notebook's one A4 portrait page with [background] printed in, as a PDF at [to], with
 * Android's PDF writer. The page is drawn in points, so it matches an Inserted page exactly.
 */
fun writeNotebookPdf(
    background: PageBackground,
    to: Path,
) {
    val document = PdfDocument()
    try {
        val page = document.startPage(PdfDocument.PageInfo.Builder(Paper.WIDTH_PT, Paper.HEIGHT_PT, 1).create())
        page.canvas.drawPaper(background, PageSize(Paper.WIDTH_PT, Paper.HEIGHT_PT))
        document.finishPage(page)
        FileOutputStream(to.toFile()).use { document.writeTo(it) }
    } finally {
        document.close()
    }
}
