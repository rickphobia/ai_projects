package com.rickphobia.ricknotes.imports

/** What a file shared to RickNotes is, going by the type the other app gave; the content is checked when read. */
enum class ShareKind { PDF, IMAGE, OTHER }

// The same types a dropped image can be; the share menu filters on these too (AndroidManifest.xml).
private val IMAGE_TYPES = setOf("image/png", "image/jpeg", "image/webp")

fun shareKindOf(type: String?): ShareKind =
    when (type) {
        "application/pdf" -> ShareKind.PDF
        in IMAGE_TYPES -> ShareKind.IMAGE
        else -> ShareKind.OTHER
    }

/** Where a shared file goes first. Paths are tree paths, relative to the Study folder. */
sealed interface ShareRoute {
    /** Pick the folder a PDF is copied into, starting at [startFolder] ("" for the top). */
    data class ChooseFolder(
        val startFolder: String,
    ) : ShareRoute

    /** Place the image on the Document at [path]. */
    data class OpenDocument(
        val path: String,
    ) : ShareRoute

    /** Pick the Document the image goes on. */
    data object ChooseDocument : ShareRoute

    data object Refuse : ShareRoute
}

/**
 * Where a [kind] share goes: next to the most recent of [recentPaths] that [exists] still finds,
 * so a moved Document doesn't stop it.
 */
fun shareRoute(
    kind: ShareKind,
    recentPaths: List<String>,
    exists: (String) -> Boolean,
): ShareRoute {
    val last = recentPaths.firstOrNull(exists)
    return when (kind) {
        ShareKind.PDF -> ShareRoute.ChooseFolder(last?.substringBeforeLast('/', missingDelimiterValue = "").orEmpty())
        ShareKind.IMAGE -> if (last != null) ShareRoute.OpenDocument(last) else ShareRoute.ChooseDocument
        ShareKind.OTHER -> ShareRoute.Refuse
    }
}
