package com.rickphobia.ricknotes.core.studyfolder

import java.io.IOException
import java.nio.file.FileSystemException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path

/** A new folder, rename or move that was refused before anything changed, such as a name clash. */
class TreeEditRefused(
    message: String,
) : IOException(message)

/**
 * A new folder, rename or move that failed on [fileName]. The files moved before it were moved
 * back, except [notMovedBack], which are still under their new names. The message names files,
 * never their folders, so it can be shown and logged.
 */
class TreeEditFailed(
    val fileName: String,
    val notMovedBack: List<String>,
    cause: Exception,
) : IOException(
        "failed at $fileName (${reasonOf(cause)})" +
            if (notMovedBack.isEmpty()) "" else "; still under the new name: ${notMovedBack.joinToString()}",
        cause,
    )

// A FileSystemException's message starts with the full paths; its reason doesn't.
private fun reasonOf(cause: Exception): String = (cause as? FileSystemException)?.reason ?: cause.javaClass.simpleName

/**
 * New folder, rename and move inside the Study folder at [root], by tree path. A Document's
 * companions (its Ink file, `.assets` and Versions) go with it, moved before the PDF. Every
 * target name is checked first and a clash refuses the whole edit; a step that fails moves the
 * done ones back. Nothing is ever overwritten or deleted. Each call returns the new tree path.
 * Slow on a big folder: call it off the main thread.
 *
 * Each call throws [TreeEditRefused] when it is refused with nothing changed, and
 * [TreeEditFailed] when a step failed.
 */
class TreeEdits(
    private val root: Path,
    private val mover: FileMover = moveWithoutReplacing,
) {
    fun newFolder(
        parent: String,
        name: String,
    ): String {
        val folderName = checkFolderName(name)
        val created = existingFolder(parent).resolve(folderName)
        refuseIf(exists(created)) { "$folderName already exists" }
        try {
            Files.createDirectory(created)
        } catch (e: IOException) {
            throw TreeEditFailed(folderName, emptyList(), e)
        }
        return childPath(parent, folderName)
    }

    fun renameDocument(
        path: String,
        name: String,
    ): String = moveDocument(path, parentOf(path), checkDocumentName(name))

    fun moveDocument(
        path: String,
        toFolder: String,
    ): String = moveDocument(path, toFolder, path.substringAfterLast('/'))

    fun renameFolder(
        path: String,
        name: String,
    ): String = moveFolder(path, parentOf(path), checkFolderName(name))

    /** Also refused when [toFolder] is [path] itself or inside it. */
    fun moveFolder(
        path: String,
        toFolder: String,
    ): String {
        refuseIf(
            toFolder == path || toFolder.startsWith("$path/"),
        ) { "can't move ${path.substringAfterLast('/')} into itself" }
        return moveFolder(path, toFolder, path.substringAfterLast('/'))
    }

    private fun moveDocument(
        path: String,
        toFolder: String,
        name: String,
    ): String {
        val pdf = resolve(path)
        refuseIf(!Files.isRegularFile(pdf, LinkOption.NOFOLLOW_LINKS)) { "${pdf.fileName} is gone" }
        val target = existingFolder(toFolder).resolve(name)
        refuseIf(target == pdf) { "$name is already there" }
        // Companions first, so a failure part-way never leaves a PDF without its ink.
        val moves = companionMoves(pdf, target) + FileMove(pdf, target)
        moves.forEach(::refuseIfTaken)
        runAll(moves, mover)
        return childPath(toFolder, name)
    }

    // A folder's companions are inside it, so one rename carries them all.
    private fun moveFolder(
        path: String,
        toFolder: String,
        name: String,
    ): String {
        refuseIf(path.isEmpty()) { "the Study folder itself can't be renamed or moved" }
        val folder = resolve(path)
        refuseIf(!Files.isDirectory(folder, LinkOption.NOFOLLOW_LINKS)) { "${folder.fileName} is gone" }
        val move = FileMove(folder, existingFolder(toFolder).resolve(name))
        refuseIf(move.to == folder) { "$name is already there" }
        refuseIfTaken(move)
        runAll(listOf(move), mover)
        return childPath(toFolder, name)
    }

    private fun existingFolder(path: String): Path {
        val folder = resolve(path)
        refuseIf(!Files.isDirectory(folder, LinkOption.NOFOLLOW_LINKS)) { "the folder ${folder.fileName} is gone" }
        return folder
    }

    private fun resolve(path: String): Path = if (path.isEmpty()) root else root.resolve(path)
}
