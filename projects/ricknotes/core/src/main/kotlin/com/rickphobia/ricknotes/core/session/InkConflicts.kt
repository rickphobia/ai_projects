package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.inkfile.InkFile
import com.rickphobia.ricknotes.core.inkfile.InkFileCodec
import com.rickphobia.ricknotes.core.inkfile.InkFileDamaged
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption

/** A Conflict copy that couldn't be resolved. The Ink file and the copy are as they were. */
class ConflictNotResolved(
    val copyName: String,
    reason: String,
    cause: Exception,
) : Exception("couldn't resolve the Conflict copy $copyName: $reason", cause)

/**
 * Resolves the sync app's Conflict copies of one Ink file, one at a time, by choice and never by
 * merging. Whichever side isn't kept is moved into Versions, so no file is deleted.
 */
internal class InkConflicts(
    private val store: InkFileStore,
    private val clock: Clock,
) {
    private val versions = VersionStore(store.inkFile)

    /** The Conflict copies beside the Ink file now, by name. */
    fun pending(): List<Path> = store.conflictCopies()

    /**
     * Keep mine: moves [copy] into Versions and leaves the Ink file alone.
     *
     * @throws ConflictNotResolved if it can't be moved.
     */
    fun keepMine(copy: Path) {
        try {
            versions.moveIn(copy, clock.nowMs())
        } catch (e: IOException) {
            throw ConflictNotResolved(copy.fileName.toString(), "can't move it into Versions", e)
        }
    }

    /**
     * Keep the other: puts [copy] in place of the Ink file, after keeping the Ink file as a Version.
     * The last step is the safe write's own: one rename over the Ink file, so a crash leaves one
     * whole Ink file or the other.
     *
     * @return the kept copy's contents, now the Ink file's.
     * @throws ConflictNotResolved if [copy] can't be read or the files can't be moved.
     */
    fun keepTheOther(copy: Path): InkFile {
        val other = read(copy)
        try {
            versions.take(clock.nowMs())
            Files.move(copy, store.inkFile, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (e: IOException) {
            throw ConflictNotResolved(copy.fileName.toString(), "can't put it in place of ${store.fileName}", e)
        }
        return other
    }

    // Read before anything moves, so a damaged copy never replaces a good Ink file.
    private fun read(copy: Path): InkFile {
        val copyName = copy.fileName.toString()
        return try {
            InkFileCodec.decode(String(Files.readAllBytes(copy), Charsets.UTF_8), copyName)
        } catch (e: IOException) {
            throw ConflictNotResolved(copyName, "can't read it", e)
        } catch (e: InkFileDamaged) {
            throw ConflictNotResolved(copyName, e.reason, e)
        }
    }
}
