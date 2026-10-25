package com.rickphobia.ricknotes.core.session

import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.NoSuchFileException
import java.nio.file.Path

/**
 * Where a Document's Ink file lives, and how it is read. The Ink file is `<pdf name>.ink.json`
 * beside the PDF. [AutoSave] writes it through [writeSafely], via the hidden
 * `.<pdf name>.ink.json.tmp`, so a crash mid-save leaves the old Ink file whole.
 */
internal class InkFileStore(
    val pdf: Path,
) {
    val inkFile: Path = pdf.resolveSibling("${pdf.fileName}$INK_SUFFIX")
    val fileName: String = inkFile.fileName.toString()

    /** The Ink file's text, or null if this Document has none yet. */
    fun read(): String? =
        try {
            // Not Files.readString: Android only has it from API 36.1, and the tablet is on 36.
            String(Files.readAllBytes(inkFile), Charsets.UTF_8)
        } catch (_: NoSuchFileException) {
            null
        }

    /** What the name of a Conflict copy of the Ink file starts with: the Ink file's name without `.json`. */
    val copyStem: String = fileName.removeSuffix(JSON_EXTENSION)

    /**
     * The sync app's Conflict copies of the Ink file, by name. FolderSync's naming is recorded in
     * the README; any file beside the Ink file whose name starts with [copyStem], such as
     * `Week 1.pdf.ink (1).json`, counts, unless it is a PDF or another PDF's Ink file. The app's
     * own temporary files start with "." and so never count.
     */
    fun conflictCopies(): List<Path> =
        Files.list(inkFile.parent).use { files ->
            // Not Stream.toList(): Android only has it from API 34, and core sticks to API 26.
            files
                .iterator()
                .asSequence()
                .filter { file ->
                    val name = file.fileName.toString()
                    name != fileName &&
                        name.startsWith(copyStem) &&
                        !name.endsWith(PDF_EXTENSION, ignoreCase = true) &&
                        !name.endsWith("$PDF_EXTENSION$INK_SUFFIX", ignoreCase = true) &&
                        Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)
                }.sortedBy { it.fileName.toString() }
                .toList()
        }

    companion object {
        const val INK_SUFFIX = ".ink.json"
        private const val JSON_EXTENSION = ".json"
        private const val PDF_EXTENSION = ".pdf"
    }
}
