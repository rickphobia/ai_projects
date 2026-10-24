package com.rickphobia.ricknotes.core.studyfolder

/**
 * [path] after the Document or folder at [from] became [to]: the same path for a Document, or a
 * path inside a folder carried along with it. Null when [path] is neither [from] nor inside it.
 */
fun renamedPath(
    path: String,
    from: String,
    to: String,
): String? =
    when {
        path == from -> to
        path.startsWith("$from/") -> to + path.substring(from.length)
        else -> null
    }
