package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.session.copySafely
import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path

private const val PDF_EXTENSION = ".pdf"
private const val FALLBACK_NAME = "Document"

/** A PDF that couldn't be copied into [folderName], so nothing was added. */
class PdfNotCopied(
    val folderName: String,
    cause: Exception,
) : IOException("couldn't copy the PDF into $folderName: ${cause.message}", cause)

/** Where [copyPdfInto] put the copy, and whether [name][copyPdfInto] was taken so it got a `(n)`. */
data class CopiedPdf(
    val path: Path,
    val nameClashed: Boolean,
)

/**
 * Copies [source] into [folder] as [name] through the safe write, so a half-copied PDF is never
 * there under its real name. A taken name becomes `tuto3 (2).pdf`, `tuto3 (3).pdf` …: nothing is
 * overwritten. [source] is only read. Any folders in [name] are dropped, and `.pdf` is added if
 * it is missing. Slow on a big PDF: call it off the main thread.
 *
 * @throws PdfNotCopied if [folder] isn't there or reading or writing fails.
 */
fun copyPdfInto(
    folder: Path,
    source: Path,
    name: String,
): CopiedPdf {
    val folderName = folder.fileName?.toString().orEmpty()
    try {
        val (base, extension) = splitName(name)
        val wanted = folder.resolve(base + extension)
        val target =
            generateSequence(2) { it + 1 }
                .map { folder.resolve("$base ($it)$extension") }
                .let { sequenceOf(wanted) + it }
                .first { !Files.exists(it, LinkOption.NOFOLLOW_LINKS) }
        copySafely(source, target)
        return CopiedPdf(target, nameClashed = target != wanted)
    } catch (e: IOException) {
        throw PdfNotCopied(folderName, e)
    } catch (e: SecurityException) {
        throw PdfNotCopied(folderName, e)
    }
}

// A hidden name would vanish from the tree, so it gets the plain one instead.
private fun splitName(name: String): Pair<String, String> {
    val fileName = name.substringAfterLast('/').trim()
    val hasExtension = fileName.endsWith(PDF_EXTENSION, ignoreCase = true)
    val base = if (hasExtension) fileName.dropLast(PDF_EXTENSION.length) else fileName
    val extension = if (hasExtension) fileName.takeLast(PDF_EXTENSION.length) else PDF_EXTENSION
    return if (base.isBlank() || base.startsWith(".")) FALLBACK_NAME to PDF_EXTENSION else base to extension
}
