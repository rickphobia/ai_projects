package com.rickphobia.ricknotes.core.studyfolder

/** One entry in the Study folder tree. [path] is relative to the Study folder, with `/` between names. */
sealed interface TreeNode {
    val name: String
    val path: String

    data class Folder(
        override val name: String,
        override val path: String,
        val children: List<TreeNode>,
    ) : TreeNode

    data class Document(
        override val name: String,
        override val path: String,
    ) : TreeNode {
        /** The tree path of the folder it is in ("" at the top of the Study folder). */
        val folder: String get() = path.substringBeforeLast('/', missingDelimiterValue = "")
    }

    /**
     * An Ink file whose PDF is missing: [name] and [path] are the PDF's, as it was when it was inked.
     * Linking it to a PDF in the same folder brings it back as that Document's ink.
     */
    data class OrphanedInk(
        override val name: String,
        override val path: String,
    ) : TreeNode
}
