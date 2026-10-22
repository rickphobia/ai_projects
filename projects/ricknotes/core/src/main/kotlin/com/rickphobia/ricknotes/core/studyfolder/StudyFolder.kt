package com.rickphobia.ricknotes.core.studyfolder

import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path

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
    ) : TreeNode
}

/** A folder inside the Study folder couldn't be listed. [folder] is its tree path ("" for the Study folder). */
class StudyFolderListingException(
    val folder: String,
    cause: IOException,
) : IOException("Can't list ${describe(folder)}: ${cause.message}", cause)

private fun describe(folder: String) =
    if (folder.isEmpty()) "the Study folder" else "the folder \"$folder\" in the Study folder"

/**
 * The Study folder as the home screen sees it: folders and PDFs only. The app's own files
 * (Ink files, `.assets`, `.versions`, `_revision_log`, hidden temporary files) are left out.
 * Browse only; creating, renaming and moving come in milestone 3.
 */
class StudyFolder(
    private val root: Path,
) {
    /**
     * Walks the whole Study folder. Slow on a big folder, so call it off the main thread.
     * @throws StudyFolderListingException if a folder in it can't be read.
     */
    fun listTree(): TreeNode.Folder = listFolder(root, "")

    /** The file on disk for a tree [path]. */
    fun resolve(path: String): Path = if (path.isEmpty()) root else root.resolve(path)

    private fun listFolder(
        folder: Path,
        path: String,
    ): TreeNode.Folder {
        val entries =
            try {
                Files.newDirectoryStream(folder).use { it.toList() }
            } catch (e: IOException) {
                throw StudyFolderListingException(path, e)
            }
        val (folders, files) =
            entries
                .filter { isShown(it) }
                .sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.fileName.toString() })
                .partition { Files.isDirectory(it, LinkOption.NOFOLLOW_LINKS) }
        val children =
            folders.map { listFolder(it, childPath(path, it)) } +
                files.map { TreeNode.Document(it.fileName.toString(), childPath(path, it)) }
        return TreeNode.Folder(folder.fileName?.toString().orEmpty(), path, children)
    }

    private fun childPath(
        parent: String,
        child: Path,
    ) = if (parent.isEmpty()) child.fileName.toString() else "$parent/${child.fileName}"

    private fun isShown(entry: Path): Boolean {
        val name = entry.fileName.toString()
        return when {
            // Covers `.versions`, the hidden `.<name>.tmp` saves, and other apps' hidden files.
            name.startsWith(".") -> {
                false
            }

            Files.isDirectory(entry, LinkOption.NOFOLLOW_LINKS) -> {
                name != REVISION_LOG_FOLDER &&
                    !name.endsWith(ASSETS_SUFFIX)
            }

            Files.isRegularFile(entry, LinkOption.NOFOLLOW_LINKS) -> {
                name.endsWith(PDF_SUFFIX, ignoreCase = true)
            }

            else -> {
                false
            }
        }
    }

    companion object {
        const val REVISION_LOG_FOLDER = "_revision_log"
        const val ASSETS_SUFFIX = ".assets"
        private const val PDF_SUFFIX = ".pdf"
    }
}
