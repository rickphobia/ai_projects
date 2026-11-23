package com.rickphobia.ricknotes.export

import android.content.Context
import com.rickphobia.ricknotes.core.export.ExportPlan
import com.rickphobia.ricknotes.logging.AppLog
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import kotlin.coroutines.cancellation.CancellationException

/** The step of an Export that failed, for the log. */
enum class ExportStep(
    val label: String,
) {
    PREPARE("emptying the export folder"),
    READ("reading the PDF"),
    DRAW("drawing the ink"),
    WRITE("writing the Export"),
}

/** An Export that couldn't be made: its partial file is gone and nothing was shared. */
class ExportFailed(
    val step: ExportStep,
    cause: Throwable,
) : Exception("Export with ink failed while ${step.label}", cause)

/**
 * Makes an Export of [pdf] from [plan]: a new PDF named like the Document, in a cache folder emptied
 * first, so no copy is ever kept in the Study folder and [pdf] is only read. [progress] gets the
 * pages done so far after each page. Runs off the main thread; cancelling the caller's coroutine
 * stops it between pages.
 *
 * @throws ExportFailed with the step that failed; the partial file is deleted.
 * @throws CancellationException when cancelled; the partial file is deleted.
 */
internal suspend fun exportWithInk(
    context: Context,
    pdf: File,
    plan: ExportPlan.WithInk,
    progress: (pagesDone: Int) -> Unit,
): File =
    withContext(Dispatchers.IO) {
        val started = System.nanoTime()
        val out = File(prepareFolder(context), pdf.name)
        // Counts, sizes and times only: never strokes or file names.
        val counts = "${plan.pages.size} pages (${plan.insertedCount} Inserted), ${plan.strokeCount} strokes"
        try {
            PDFBoxResourceLoader.init(context.applicationContext)
            read(pdf).use { document ->
                // The Export is for any reader and the AI apps, so it goes without the PDF's own
                // permissions lock, which would stop the slide text being selected (decision 0008).
                document.isAllSecurityToBeRemoved = true
                draw(document, plan, progress) { ensureActive() }
                ensureActive()
                write(document, out)
            }
        } catch (e: CancellationException) {
            out.delete()
            AppLog.i("Export with ink cancelled: $counts")
            throw e
        } catch (e: ExportFailed) {
            out.delete()
            AppLog.e("Export with ink failed while ${e.step.label}: $counts", e)
            throw e
        }
        AppLog.i(
            "Export with ink for the Share sheet: $counts, ${out.length()} bytes in " +
                "${(System.nanoTime() - started) / NANOS_PER_MS} ms",
        )
        out
    }

// Empties the export folder, so the last Export is never left behind.
private fun prepareFolder(context: Context): File {
    val folder = File(context.cacheDir, EXPORT_FOLDER)
    if (!folder.deleteRecursively() || !folder.mkdirs()) {
        throw ExportFailed(ExportStep.PREPARE, IOException("can't empty and make the export folder"))
    }
    return folder
}

// PDFBox reports a damaged file as an IOException, and some broken structures as runtime errors.
@Suppress("TooGenericExceptionCaught")
private fun read(pdf: File): PDDocument =
    try {
        // Scratch data in temporary files, so a 100-page lecture doesn't run the app out of memory.
        PDDocument.load(pdf, MemoryUsageSetting.setupTempFileOnly())
    } catch (e: IOException) {
        throw ExportFailed(ExportStep.READ, e)
    } catch (e: RuntimeException) {
        throw ExportFailed(ExportStep.READ, e)
    }

@Suppress("TooGenericExceptionCaught")
private fun draw(
    document: PDDocument,
    plan: ExportPlan.WithInk,
    progress: (Int) -> Unit,
    checkCancelled: () -> Unit,
) {
    val alphaStates = AlphaStates()
    var previous: PDPage? = null
    plan.pages.forEachIndexed { index, page ->
        checkCancelled()
        previous =
            try {
                drawExportPage(document, page, previous, alphaStates)
            } catch (e: IOException) {
                throw ExportFailed(ExportStep.DRAW, e)
            } catch (e: RuntimeException) {
                throw ExportFailed(ExportStep.DRAW, e)
            }
        progress(index + 1)
    }
}

@Suppress("TooGenericExceptionCaught")
private fun write(
    document: PDDocument,
    out: File,
) {
    try {
        document.save(out)
    } catch (e: IOException) {
        throw ExportFailed(ExportStep.WRITE, e)
    } catch (e: RuntimeException) {
        throw ExportFailed(ExportStep.WRITE, e)
    }
}

// Under the cache path that res/xml/shared_files.xml lets the FileProvider share.
private const val EXPORT_FOLDER = "shared/export"
private const val NANOS_PER_MS = 1_000_000
