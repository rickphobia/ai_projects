package com.rickphobia.ricknotes.logpdf

import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import androidx.core.graphics.withTranslation
import com.rickphobia.ricknotes.core.ink.Paper
import com.rickphobia.ricknotes.core.logpdf.LogPdfLayout
import com.rickphobia.ricknotes.core.logpdf.LogPdfPage
import com.rickphobia.ricknotes.core.logpdf.PlacedEntry
import com.rickphobia.ricknotes.core.logpdf.SnipSize
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.logging.AppLog
import java.io.OutputStream
import java.nio.file.Path

/** The size of the Snip in [png] without decoding it, or null when it can't be read. */
internal fun snipSize(png: Path): SnipSize? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(png.toString(), bounds)
    return if (bounds.outWidth > 0 && bounds.outHeight > 0) SnipSize(bounds.outWidth, bounds.outHeight) else null
}

/**
 * Draws [pages] with Android's PDF writer into [out]: each Entry's [label] lines, then the crop of
 * its back Snip from [backSnip]. One Snip is decoded at a time, so a long log doesn't run out of memory.
 */
internal fun drawLogPdf(
    pages: List<LogPdfPage>,
    backSnip: (Entry) -> Path,
    label: (Entry) -> EntryLabel,
    out: OutputStream,
) {
    val document = PdfDocument()
    try {
        pages.forEachIndexed { index, logPage ->
            val page =
                document.startPage(
                    PdfDocument.PageInfo.Builder(Paper.WIDTH_PT, Paper.HEIGHT_PT, index + 1).create(),
                )
            logPage.entries.forEach { placed ->
                page.canvas.drawLabel(placed, label(placed.entry))
                page.canvas.drawSnip(placed, backSnip(placed.entry))
            }
            document.finishPage(page)
        }
        document.writeTo(out)
    } finally {
        document.close()
    }
}

private fun Canvas.drawLabel(
    placed: PlacedEntry,
    label: EntryLabel,
) {
    val width = placed.text.width.toInt()
    val titlePaint = textPaint(Typeface.DEFAULT_BOLD)
    val title = TextUtils.ellipsize(label.title, titlePaint, width.toFloat(), TextUtils.TruncateAt.END)
    drawText(title, 0, title.length, placed.text.left, placed.text.top - titlePaint.ascent(), titlePaint)
    if (label.details.isEmpty()) return
    val detailsPaint = textPaint(Typeface.DEFAULT)
    val details =
        StaticLayout.Builder
            .obtain(label.details, 0, label.details.length, detailsPaint, width)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setMaxLines(LogPdfLayout.LABEL_LINES - 1)
            .setEllipsize(TextUtils.TruncateAt.END)
            .build()
    withTranslation(placed.text.left, placed.text.top + LogPdfLayout.LABEL_LINE_HEIGHT_PT) { details.draw(this) }
}

private fun Canvas.drawSnip(
    placed: PlacedEntry,
    png: Path,
) {
    val crop = placed.crop
    val target = placed.snip
    // No crop means the layout already found the Snip unreadable and left room for text only.
    val bitmap = if (crop == null || target == null) null else BitmapFactory.decodeFile(png.toString())
    if (crop == null || target == null || bitmap == null) {
        if (crop != null) AppLog.w("Log PDF: Snip ${png.fileName} can't be read, left out")
        return
    }
    try {
        val to = RectF(target.left, target.top, target.right, target.bottom)
        drawBitmap(bitmap, Rect(crop.left, crop.top, crop.right, crop.bottom), to, Paint(Paint.FILTER_BITMAP_FLAG))
        drawRect(to, outline)
    } finally {
        bitmap.recycle()
    }
}

private fun textPaint(typeface: Typeface) =
    TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        this.typeface = typeface
        textSize = TEXT_SIZE_PT
        color = Color.BLACK
    }

// A thin grey frame, so a Snip with a white edge still reads as one picture on the white page.
private val outline =
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = OUTLINE_WIDTH_PT
        color = Paper.LINE_COLOUR_ARGB
    }

// Fits a line of LABEL_LINE_HEIGHT_PT with room between lines.
private const val TEXT_SIZE_PT = 10.5f
private const val OUTLINE_WIDTH_PT = 0.5f
