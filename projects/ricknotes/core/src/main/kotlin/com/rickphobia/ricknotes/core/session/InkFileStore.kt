package com.rickphobia.ricknotes.core.session

import java.nio.file.Files
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

    companion object {
        const val INK_SUFFIX = ".ink.json"
    }
}
