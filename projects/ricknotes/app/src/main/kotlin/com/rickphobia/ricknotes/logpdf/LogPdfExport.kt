package com.rickphobia.ricknotes.logpdf

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.rickphobia.ricknotes.core.logpdf.ExportedEntry
import com.rickphobia.ricknotes.core.logpdf.LogPdfFile
import com.rickphobia.ricknotes.core.logpdf.LogPdfLayout
import com.rickphobia.ricknotes.core.logpdf.LogPdfWriteFailed
import com.rickphobia.ricknotes.core.logpdf.NothingToExport
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.RevisionLogSession
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.snip.SNIP_ZOOM_MARGIN_PT
import java.io.File

/**
 * Exports [entries] (the Revision log screen's filter, in its order) of [courseFolder]'s log as
 * `<course> revision log.pdf` in that folder, replacing the last export, and returns the PDF.
 * Reads Snips and writes the file: call it off the main thread.
 *
 * @throws NothingToExport if [entries] is empty; nothing is written.
 * @throws LogPdfWriteFailed if the PDF can't be written; the last export is then whole.
 */
internal fun exportLogPdf(
    context: Context,
    session: RevisionLogSession,
    courseFolder: File,
    entries: List<Entry>,
): File {
    val started = System.nanoTime()
    val pages =
        try {
            LogPdfLayout.pages(entries.map { ExportedEntry(it, snipSize(session.backSnip(it))) }, SNIP_ZOOM_MARGIN_PT)
        } catch (e: NothingToExport) {
            AppLog.i("Log PDF of ${courseFolder.name}: nothing to export")
            throw e
        }
    val pdf =
        try {
            LogPdfFile.write(courseFolder.toPath()) { out ->
                drawLogPdf(pages, session::backSnip, { EntryLabel.of(context, it) }, out)
            }
        } catch (e: LogPdfWriteFailed) {
            AppLog.e("Log PDF of ${courseFolder.name} failed: ${entries.size} Entries, ${pages.size} pages", e)
            throw e
        }.toFile()
    // Counts and size only: never the Snips or "why" text.
    AppLog.i(
        "Log PDF of ${courseFolder.name} exported: ${entries.size} Entries, ${pages.size} pages, " +
            "${pdf.length()} bytes in ${(System.nanoTime() - started) / NANOS_PER_MS} ms",
    )
    return pdf
}

/** Opens the Share sheet for [pdf], through a content URI only the app it goes to can read. */
internal fun shareLogPdf(
    context: Context,
    pdf: File,
) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", pdf)
    val share =
        Intent(Intent.ACTION_SEND)
            .setType(PDF_TYPE)
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    // Some apps read the PDF from ClipData rather than EXTRA_STREAM.
    share.clipData = ClipData.newRawUri(pdf.name, uri)
    try {
        context.startActivity(Intent.createChooser(share, pdf.name))
    } catch (e: ActivityNotFoundException) {
        AppLog.e("Log PDF: no app took the share", e)
    }
}

private const val PDF_TYPE = "application/pdf"
private const val NANOS_PER_MS = 1_000_000
