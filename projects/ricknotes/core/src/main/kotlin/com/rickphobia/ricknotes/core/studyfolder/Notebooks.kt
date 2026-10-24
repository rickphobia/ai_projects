package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.inkfile.InkFile
import com.rickphobia.ricknotes.core.inkfile.InkFileCodec
import com.rickphobia.ricknotes.core.session.InkFileStore
import com.rickphobia.ricknotes.core.session.writeSafely
import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.time.LocalDate

/**
 * A Notebook that couldn't be made; [pdfMade] when its PDF is there all the same, without the
 * Notebook mark in its Ink file, so it has no Add page.
 */
class NotebookNotCreated(
    val pdfMade: Boolean,
    cause: Exception,
) : IOException(
        if (pdfMade) {
            "the Notebook's PDF was made but couldn't be marked as a Notebook, so it has no Add page (${cause.message})"
        } else {
            "couldn't make the Notebook: ${cause.message}"
        },
        cause,
    )

/**
 * Makes Notebooks in the Study folder at [root]: a one-page PDF, written by [writePdf] (Android's
 * PDF writer, with [PageBackground] printed in) to a scratch file in [scratch], then copied in
 * through the safe copy. Its Ink file records the background, so Add page can match it.
 */
class Notebooks(
    private val root: Path,
    private val scratch: Path,
    private val writePdf: (background: PageBackground, to: Path) -> Unit,
) {
    /**
     * Makes a [background] Notebook for the folder at tree path [folder] (see [notebookFolder]),
     * named for [today] (see [notebookName]) with `(2)`, `(3)` … when taken. Returns its tree path.
     * Slow: call it off the main thread.
     *
     * @throws NotebookNotCreated if writing or copying fails.
     */
    fun create(
        folder: String,
        courses: CourseFolders,
        background: PageBackground,
        today: LocalDate,
    ): String {
        val into = notebookFolder(folder, courses) { Files.isDirectory(resolve(it), LinkOption.NOFOLLOW_LINKS) }
        val pdf =
            failingAs(pdfMade = false) {
                val written = Files.createTempFile(scratch, "notebook", ".pdf")
                try {
                    writePdf(background, written)
                    copyPdfInto(resolve(into), written, notebookName(today)).path
                } finally {
                    Files.deleteIfExists(written)
                }
            }
        failingAs(pdfMade = true) {
            val ink = InkFile(1, InkFile.pdfPages(1), emptyList(), notebook = background)
            writeSafely(InkFileStore(pdf).inkFile, InkFileCodec.encode(ink).toByteArray(Charsets.UTF_8))
        }
        return childPath(into, pdf.fileName.toString())
    }

    // One throw per kind of error is the point of it.
    @Suppress("ThrowsCount")
    private fun <T> failingAs(
        pdfMade: Boolean,
        step: () -> T,
    ): T =
        try {
            step()
        } catch (e: IOException) {
            throw NotebookNotCreated(pdfMade, e)
        } catch (e: SecurityException) {
            throw NotebookNotCreated(pdfMade, e)
        }

    private fun resolve(path: String): Path = if (path.isEmpty()) root else root.resolve(path)

    companion object {
        const val PERSONAL_NOTES_FOLDER = "pnotes"

        /**
         * Where a Notebook made from the folder [folder] goes: its `pnotes` folder when it is a
         * Course folder that has one ([isFolder] says), else [folder] itself.
         */
        fun notebookFolder(
            folder: String,
            courses: CourseFolders,
            isFolder: (String) -> Boolean,
        ): String {
            val personal = childPath(folder, PERSONAL_NOTES_FOLDER)
            return if (courses.isCourse(folder) && isFolder(personal)) personal else folder
        }

        /** `Notes 2026-10-24.pdf`; a taken name gets `(2)`, `(3)` … when it is copied in. */
        fun notebookName(today: LocalDate): String = "Notes $today.pdf"
    }
}
