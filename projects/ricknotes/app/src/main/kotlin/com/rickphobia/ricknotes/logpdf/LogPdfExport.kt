package com.rickphobia.ricknotes.logpdf

import android.content.Context
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

private const val NANOS_PER_MS = 1_000_000
