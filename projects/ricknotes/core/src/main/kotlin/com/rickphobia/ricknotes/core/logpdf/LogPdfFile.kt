package com.rickphobia.ricknotes.core.logpdf

import com.rickphobia.ricknotes.core.session.temporaryFileFor
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption

/** A Revision log's exported PDF couldn't be written; the last export, if any, is as it was. */
class LogPdfWriteFailed(
    val fileName: String,
    cause: Exception,
) : Exception("couldn't write $fileName: ${cause.message}", cause)

/**
 * A course's exported Revision log: `<course> revision log.pdf` in its Course folder, a plain PDF
 * that the tree shows and the sync app syncs like any other Document.
 */
object LogPdfFile {
    private const val SUFFIX = " revision log.pdf"

    /** Where [courseFolder]'s Revision log PDF goes. */
    fun of(courseFolder: Path): Path = courseFolder.resolve("${courseFolder.fileName}$SUFFIX")

    /**
     * Writes [courseFolder]'s Revision log PDF with [writePdf], replacing the last export the way
     * the safe write does: into the hidden temporary file, flushed to disk, then renamed over it in
     * one step. It streams, so a PDF of many Snips isn't held in memory twice. Returns the PDF's path.
     *
     * @throws LogPdfWriteFailed if any step fails, including [writePdf] throwing an
     *   [IllegalStateException] or [IllegalArgumentException] (as Android's PDF writer does); the
     *   last export is then whole and no temporary file is left.
     */
    fun write(
        courseFolder: Path,
        writePdf: (OutputStream) -> Unit,
    ): Path {
        val target = of(courseFolder)
        val temporary = temporaryFileFor(target)
        var failure: Exception? = null
        try {
            FileOutputStream(temporary.toFile()).use { out ->
                writePdf(out)
                out.fd.sync()
            }
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (e: IOException) {
            failure = e
        } catch (e: SecurityException) {
            failure = e
        } catch (e: IllegalStateException) {
            failure = e
        } catch (e: IllegalArgumentException) {
            failure = e
        }
        failure?.let { throw failed(target, temporary, it) }
        return target
    }

    // The error for a failed write, after removing the half-written temporary file. A failure to
    // remove it is kept with the error rather than hiding why the write failed.
    private fun failed(
        target: Path,
        temporary: Path,
        cause: Exception,
    ): LogPdfWriteFailed {
        val error = LogPdfWriteFailed(target.fileName.toString(), cause)
        try {
            Files.deleteIfExists(temporary)
        } catch (cleanup: IOException) {
            error.addSuppressed(cleanup)
        }
        return error
    }
}
