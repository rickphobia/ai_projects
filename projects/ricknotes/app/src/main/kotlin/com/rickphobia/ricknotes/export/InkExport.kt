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
    PICTURES("reading a Picture"),
    DRAW("drawing the ink"),
    WRITE("writing the Export"),
}

/** An Export that couldn't be made: its partial file is gone and nothing was shared. */
class ExportFailed(
    val step: ExportStep,
    cause: Throwable,
) : Exception("Export with ink failed while ${step.label}", cause)

/**
 * Makes an Export of [pdf] from [plan], its Pictures' images read from [assetsFolder]: a new PDF
 * named like the Document, in a cache folder emptied first, so no copy is ever kept in the Study
 * folder and [pdf] is only read. [progress] gets the pages done so far after each page. Runs off
 * the main thread; cancelling the caller's coroutine stops it between pages.
 *
 * @throws ExportFailed with the step that failed; the partial file is deleted. A Picture whose
 *   image is missing fails it at [ExportStep.PICTURES] with [PictureMissing], rather than leaving a gap.
 * @throws CancellationException when cancelled; the partial file is deleted.
 */
internal suspend fun exportWithInk(
    context: Context,
    pdf: File,
    assetsFolder: File,
    plan: ExportPlan.WithInk,
    progress: (pagesDone: Int) -> Unit,
): File =
    withContext(Dispatchers.IO) {
        val started = System.nanoTime()
        // Counts, sizes and times only: never strokes, Picture images or file names.
        val counts =
            "${plan.pages.size} pages (${plan.insertedCount} Inserted), ${plan.strokeCount} strokes, " +
                "${plan.pictureCount} Pictures"
        val out =
            try {
                File(inStep(ExportStep.PREPARE) { emptyFolder(context) }, pdf.name)
            } catch (e: ExportFailed) {
                logFailure(e, counts)
                throw e
            }
        try {
            read(context, pdf).use { document ->
                // The Export is for any reader and the AI apps, so it goes without the PDF's own
                // permissions lock, which would stop the slide text being selected (decision 0008).
                document.isAllSecurityToBeRemoved = true
                draw(document, PictureImages(document, assetsFolder), plan, progress) { ensureActive() }
                ensureActive()
                inStep(ExportStep.WRITE) { document.save(out) }
            }
            // Saving can't be stopped halfway, so a Cancel tapped meanwhile is honoured here.
            ensureActive()
        } catch (e: CancellationException) {
            out.delete()
            AppLog.i("Export with ink cancelled: $counts")
            throw e
        } catch (e: ExportFailed) {
            out.delete()
            logFailure(e, counts)
            throw e
        }
        AppLog.i(
            "Export with ink for the Share sheet: $counts, ${out.length()} bytes in " +
                "${(System.nanoTime() - started) / NANOS_PER_MS} ms",
        )
        out
    }

// Only the error's type, not its message: PDFBox and file errors put the path, with the Document's
// name, in their messages.
private fun logFailure(
    e: ExportFailed,
    counts: String,
) = AppLog.e("Export with ink failed while ${e.step.label}: $counts (${e.cause?.javaClass?.name})")

/**
 * Runs [work] as [step] of an Export, turning whatever stops it into [ExportFailed]: PDFBox reports
 * a damaged file as an IOException and some broken structures as runtime errors, and a huge page
 * can run the app out of memory, which must fail the Export rather than crash the app.
 */
@Suppress("TooGenericExceptionCaught")
private inline fun <T> inStep(
    step: ExportStep,
    work: () -> T,
): T =
    try {
        work()
    } catch (e: IOException) {
        throw ExportFailed(step, e)
    } catch (e: RuntimeException) {
        throw ExportFailed(step, e)
    } catch (e: OutOfMemoryError) {
        throw ExportFailed(step, e)
    }

// Empties the export folder, so the last Export is never left behind.
private fun emptyFolder(context: Context): File {
    val folder = File(context.cacheDir, EXPORT_FOLDER)
    if (!folder.deleteRecursively() || !folder.mkdirs()) throw IOException("can't empty and make the export folder")
    return folder
}

private fun read(
    context: Context,
    pdf: File,
): PDDocument =
    inStep(ExportStep.READ) {
        PDFBoxResourceLoader.init(context.applicationContext)
        // Scratch data in temporary files, so a 100-page lecture doesn't run the app out of memory.
        PDDocument.load(pdf, MemoryUsageSetting.setupTempFileOnly())
    }

private fun draw(
    document: PDDocument,
    images: PictureImages,
    plan: ExportPlan.WithInk,
    progress: (Int) -> Unit,
    checkCancelled: () -> Unit,
) {
    val shared = SharedResources(AlphaStates(), images)
    // Listed before any Inserted page is added, which would shift the document's page numbers.
    val pdfPages = document.pages.toList()
    var previous: PDPage? = null
    plan.pages.forEachIndexed { index, page ->
        checkCancelled()
        // Read first, so a missing image fails as its own step, with nothing half drawn.
        inStep(ExportStep.PICTURES) { page.pictures.forEach(images::of) }
        previous = inStep(ExportStep.DRAW) { drawExportPage(document, pdfPages, page, previous, shared) }
        progress(index + 1)
    }
}

// Under the cache path that res/xml/shared_files.xml lets the FileProvider share.
private const val EXPORT_FOLDER = "shared/export"
private const val NANOS_PER_MS = 1_000_000
