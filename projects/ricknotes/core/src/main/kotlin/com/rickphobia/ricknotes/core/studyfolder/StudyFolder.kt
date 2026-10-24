package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.presets.PresetsFile
import com.rickphobia.ricknotes.core.session.InkFileStore
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
 * (Ink files, `.assets`, `.versions`, `_revision_log`, `_ricknotes`, hidden temporary files) are left out,
 * except that an Ink file whose PDF is missing is listed as [TreeNode.OrphanedInk].
 * Listing only; [TreeEdits] creates, renames, moves and links.
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

    /**
     * The PDFs that the Orphaned ink at tree path [orphan] can be linked to: those in its folder
     * with no Ink file, by tree path, sorted by name ignoring case.
     * @throws StudyFolderListingException if the folder can't be read.
     */
    fun linkCandidates(orphan: String): List<String> {
        val folder = parentOf(orphan)
        return entriesOf(resolve(folder), folder)
            .filter { isShown(it) && !Files.isDirectory(it, LinkOption.NOFOLLOW_LINKS) }
            .filterNot { exists(InkFileStore(it).inkFile) }
            .map { it.fileName.toString() }
            .sortedWith(String.CASE_INSENSITIVE_ORDER)
            .map { childPath(folder, it) }
    }

    /** The file on disk for a tree [path]. */
    fun resolve(path: String): Path = if (path.isEmpty()) root else root.resolve(path)

    private fun listFolder(
        folder: Path,
        path: String,
        onUnreadable: UnreadableFolderListener,
    ): TreeNode.Folder {
        val entries = entriesOf(folder, path)
        val (folders, files) =
            entries
                .filter { isShown(it) }
                .sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.fileName.toString() })
                .partition { Files.isDirectory(it, LinkOption.NOFOLLOW_LINKS) }
        val documents = files.map { it.fileName.toString() }.map { TreeNode.Document(it, childPath(path, it)) }
        val orphans = entries.mapNotNull(::orphanedPdfName).map { TreeNode.OrphanedInk(it, childPath(path, it)) }
        val children =
            folders.mapNotNull { listSubfolder(it, childPath(path, it.fileName.toString()), onUnreadable) } +
                (documents + orphans).sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.name })
        return TreeNode.Folder(folder.fileName?.toString().orEmpty(), path, children)
    }

    private fun entriesOf(
        folder: Path,
        path: String,
    ): List<Path> =
        try {
            Files.newDirectoryStream(folder).use { it.toList() }
        } catch (e: IOException) {
            throw StudyFolderListingException(path, e)
        }

    // The name of the missing PDF if [entry] is an Ink file without one, else null.
    private fun orphanedPdfName(entry: Path): String? {
        val name = entry.fileName.toString()
        val pdfName = name.removeSuffix(InkFileStore.INK_SUFFIX)
        val isInk =
            pdfName != name &&
                !name.startsWith(".") &&
                pdfName.endsWith(PDF_SUFFIX, ignoreCase = true) &&
                Files.isRegularFile(entry, LinkOption.NOFOLLOW_LINKS)
        return pdfName.takeIf { isInk && !exists(entry.resolveSibling(it)) }
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
