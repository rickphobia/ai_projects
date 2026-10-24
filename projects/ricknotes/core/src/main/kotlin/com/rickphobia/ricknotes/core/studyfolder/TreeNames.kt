package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.presets.PresetsFile
import com.rickphobia.ricknotes.core.session.PictureAssets

private const val PDF_EXTENSION = ".pdf"
private const val REVISION_LOG_FOLDER = "_revision_log"

internal fun refuseIf(
    refused: Boolean,
    message: () -> String,
) {
    if (refused) throw TreeEditRefused(message())
}

internal fun parentOf(path: String) = path.substringBeforeLast('/', missingDelimiterValue = "")

internal fun childPath(
    parent: String,
    name: String,
) = if (parent.isEmpty()) name else "$parent/$name"

/** [name] trimmed, or refused if the tree would hide it or it reaches outside its folder. */
private fun checkName(name: String): String {
    val trimmed = name.trim()
    refuseIf(trimmed.isEmpty()) { "the name is empty" }
    refuseIf('/' in trimmed || '\\' in trimmed || '\u0000' in trimmed) { "a name can't have / or \\ in it" }
    refuseIf(trimmed.startsWith(".")) { "a name can't start with a dot" }
    return trimmed
}

/** A usable folder name from [name]; the names of RickNotes' own folders are refused. */
internal fun checkFolderName(name: String): String {
    val checked = checkName(name)
    val ownFolder = checked == REVISION_LOG_FOLDER || checked == PresetsFile.FOLDER
    refuseIf(ownFolder || checked.endsWith(PictureAssets.ASSETS_SUFFIX)) {
        "$checked is a name RickNotes uses for its own files"
    }
    return checked
}

/** A usable Document name from [name], with `.pdf` added when missing so the tree still shows it. */
internal fun checkDocumentName(name: String): String {
    val checked = checkName(name)
    val hasExtension = checked.endsWith(PDF_EXTENSION, ignoreCase = true)
    refuseIf(hasExtension && checked.length == PDF_EXTENSION.length) { "the name is empty" }
    return if (hasExtension) checked else "$checked$PDF_EXTENSION"
}
