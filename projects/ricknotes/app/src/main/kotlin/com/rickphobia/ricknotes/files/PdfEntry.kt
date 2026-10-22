package com.rickphobia.ricknotes.files

/** A PDF in the Study folder. [folder] is its folder relative to the Study folder ("" at the top). */
data class PdfEntry(
    val path: String,
    val folder: String,
    val name: String,
) {
    /** Its path relative to the Study folder, as the Study folder tree names it. */
    val treePath: String get() = if (folder.isEmpty()) name else "$folder/$name"
}
