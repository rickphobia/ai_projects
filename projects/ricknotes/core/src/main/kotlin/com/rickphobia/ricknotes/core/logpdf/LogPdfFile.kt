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
     * Writes [courseFolder]'s Revision log PDF with [write], replacing the last export the way the
     * safe write does: into the hidden temporary file, flushed to disk, then renamed over it in one
     * step. It streams, so a PDF of many Snips isn't held in memory twice. Returns the PDF's path.
     *
     * @throws LogPdfWriteFailed if any step fails; the last export is then whole and no temporary file is left.
     */
    fun write(
        courseFolder: Path,
        write: (OutputStream) -> Unit,
    ): Path {
        val target = of(courseFolder)
        val temporary = temporaryFileFor(target)
        try {
            FileOutputStream(temporary.toFile()).use { out ->
                write(out)
                out.fd.sync()
            }
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (e: IOException) {
            throw LogPdfWriteFailed(target.fileName.toString(), e)
        } catch (e: SecurityException) {
            throw LogPdfWriteFailed(target.fileName.toString(), e)
        } finally {
            // Gone already after the rename; after a failure, nothing half-written is left behind.
            Files.deleteIfExists(temporary)
        }
        return target
    }
}
