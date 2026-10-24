package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.presets.PresetsFile
import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path

/** A folder inside the Study folder couldn't be listed. [folder] is its tree path ("" for the Study folder). */
class StudyFolderListingException(
    val folder: String,
    cause: IOException,
) : IOException("Can't list ${describe(folder)}: ${cause.message}", cause)

private fun describe(folder: String) =
    if (folder.isEmpty()) "the Study folder" else "the folder \"$folder\" in the Study folder"

/** Told about each subfolder [StudyFolder.listTree] had to leave out because it couldn't be read. */
typealias UnreadableFolderListener = (folder: String, error: StudyFolderListingException) -> Unit

/**
 * The Study folder as the home screen sees it: folders and PDFs only. The app's own files
 * (Ink files, `.assets`, `.versions`, `_revision_log`, `_ricknotes`, hidden temporary files) are left out.
 * Listing only; [TreeEdits] creates, renames and moves.
 */
class StudyFolder(
    private val root: Path,
) {
    /**
     * Walks the whole Study folder. Slow on a big folder, so call it off the main thread.
     * A subfolder that can't be read is left out and passed to [onUnreadable], so one odd
     * folder doesn't hide the rest.
     * @throws StudyFolderListingException if the Study folder itself can't be read.
     */
    fun listTree(onUnreadable: UnreadableFolderListener): TreeNode.Folder = listFolder(root, "", onUnreadable)

    /** The file on disk for a tree [path]. */
    fun resolve(path: String): Path = if (path.isEmpty()) root else root.resolve(path)

    private fun listFolder(
        folder: Path,
        path: String,
        onUnreadable: UnreadableFolderListener,
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
            folders.mapNotNull { listSubfolder(it, childPath(path, it), onUnreadable) } +
                files.map { TreeNode.Document(it.fileName.toString(), childPath(path, it)) }
        return TreeNode.Folder(folder.fileName?.toString().orEmpty(), path, children)
    }

    private fun listSubfolder(
        folder: Path,
        path: String,
        onUnreadable: UnreadableFolderListener,
    ): TreeNode.Folder? =
        try {
            listFolder(folder, path, onUnreadable)
        } catch (e: StudyFolderListingException) {
            onUnreadable(e.folder, e)
            null
        }

    private fun childPath(
        parent: String,
        child: Path,
    ) = if (parent.isEmpty()) child.fileName.toString() else "$parent/${child.fileName}"

    private fun isShown(entry: Path): Boolean {
        val name = entry.fileName.toString()
        return when {
            // Covers `.versions`, the hidden `.<name>.tmp` saves, and other apps' hidden files.
            // A temporary file without the dot is still hidden, because only PDFs are shown.
            name.startsWith(".") -> {
                false
            }

            Files.isDirectory(entry, LinkOption.NOFOLLOW_LINKS) -> {
                name != REVISION_LOG_FOLDER &&
                    name != PresetsFile.FOLDER &&
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

    private companion object {
        const val REVISION_LOG_FOLDER = "_revision_log"
        const val ASSETS_SUFFIX = ".assets"
        const val PDF_SUFFIX = ".pdf"
    }
}
