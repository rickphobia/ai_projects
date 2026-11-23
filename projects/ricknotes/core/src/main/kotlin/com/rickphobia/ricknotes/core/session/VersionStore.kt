package com.rickphobia.ricknotes.core.session

import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.StandardCopyOption

/** A Version that couldn't be taken. The file and its session carry on as before. */
class VersionFailed(
    val fileName: String,
    cause: Exception,
) : Exception("couldn't take a Version of $fileName: ${cause.message}", cause)

/**
 * A file's Versions (an Ink file's, a Revision log's): copies of it in the hidden [FOLDER] beside
 * it, named `<file name>.<time in ms>.version`. Only the newest [KEEP] are kept.
 */
internal class VersionStore(
    private val file: Path,
) {
    private val folder: Path = file.resolveSibling(FOLDER)
    private val prefix = "${file.fileName}."

    /**
     * Copies the file as it is now into a Version taken at [nowMs], then drops the oldest beyond
     * [KEEP]. Does nothing if there is no file.
     *
     * @throws IOException if the copy or the clean-up fails.
     */
    fun take(nowMs: Long) {
        val bytes = readFile() ?: return
        write(bytes, nowMs)
    }

    /**
     * Like [take], but takes no Version when the file is the same as the newest one, so the [KEEP]
     * kept are different moments rather than the same ink opened again and again.
     *
     * @return true if no Version was taken because the file is the same as the newest one.
     * @throws IOException if a read, the copy or the clean-up fails.
     */
    fun takeUnlessSame(nowMs: Long): Boolean {
        val bytes = readFile() ?: return false
        val same = newest()?.let { Files.readAllBytes(it).contentEquals(bytes) } ?: false
        if (!same) write(bytes, nowMs)
        return same
    }

    private fun newest(): Path? = if (Files.isDirectory(folder)) ours().maxByOrNull { it.first }?.second else null

    private fun readFile(): ByteArray? =
        try {
            Files.readAllBytes(file)
        } catch (_: NoSuchFileException) {
            null
        }

    private fun write(
        bytes: ByteArray,
        nowMs: Long,
    ) {
        Files.createDirectories(folder)
        writeSafely(freeVersion(nowMs), bytes)
        dropOldest()
    }

    /**
     * Moves [other], another copy of the file such as the sync app's Conflict copy, into a Version
     * taken at [nowMs], then drops the oldest beyond [KEEP]. It is renamed, never copied and deleted.
     *
     * @throws IOException if the move or the clean-up fails; [other] stays where it was if the move did.
     */
    fun moveIn(
        other: Path,
        nowMs: Long,
    ) {
        Files.createDirectories(folder)
        Files.move(other, freeVersion(nowMs), StandardCopyOption.ATOMIC_MOVE)
        dropOldest()
    }

    // The Version's file for [nowMs], a millisecond later if that is taken, so none is written over.
    private fun freeVersion(nowMs: Long): Path =
        generateSequence(nowMs) { it + 1 }
            .map { folder.resolve("$prefix$it$SUFFIX") }
            .first { !Files.exists(it, LinkOption.NOFOLLOW_LINKS) }

    // This file's Versions, each with the time it was taken.
    private fun ours(): List<Pair<Long, Path>> =
        Files.list(folder).use { files ->
            files
                .iterator()
                .asSequence()
                .mapNotNull { file -> takenAtMs(file.fileName.toString())?.let { it to file } }
                .toList()
        }

    private fun dropOldest() {
        ours().sortedByDescending { it.first }.drop(KEEP).forEach { Files.deleteIfExists(it.second) }
    }

    // Null for anything that isn't one of this file's Versions, such as another Document's.
    private fun takenAtMs(name: String): Long? =
        name
            .takeIf { it.startsWith(prefix) && it.endsWith(SUFFIX) }
            ?.substring(prefix.length, name.length - SUFFIX.length)
            ?.toLongOrNull()

    companion object {
        /** The hidden folder beside the saved files that holds their Versions; the sync app skips it. */
        const val FOLDER = ".versions"
        const val SUFFIX = ".version"

        /** Versions kept per file: enough to go back hours without filling the tablet. */
        const val KEEP = 10
    }
}
