package com.rickphobia.ricknotes.core.session

import java.io.IOException
import java.nio.file.Path

enum class SaveStatus {
    /** Every change is in the file. */
    SAVED,

    /** There are changes a save is scheduled for. */
    PENDING,

    /** The last save failed: changes are only in memory until a retry succeeds. Shown as "Not saved". */
    FAILED,
}

/** A save that didn't reach the file; the old file is untouched and the changes are kept. */
class InkSaveFailed(
    val fileName: String,
    cause: Exception,
) : Exception("couldn't save $fileName: ${cause.message}", cause)

/**
 * What the session reports as it saves, for the screen and the log. Called on whichever thread
 * saved; [statusChanged] is called with the session's lock held, so statuses arrive in order and it
 * must not call back into the session.
 */
interface SaveListener {
    fun statusChanged(status: SaveStatus) {}

    fun saved(
        fileName: String,
        bytes: Int,
        durationMs: Long,
    ) {}

    fun saveFailed(error: InkSaveFailed) {}

    fun versionFailed(error: VersionFailed) {}
}

/**
 * Keeps one file saved for the session that owns it (a Document session's Ink file, a Revision
 * log's `revision_log.json`). It saves [SAVE_DELAY_MS] after the last change or at once on
 * [saveNow], tries a failed save again every [RETRY_DELAY_MS] until it works, and writes through
 * [writeSafely] so a failed save leaves the old file whole. Just before a save overwrites the file,
 * it takes a Version of it if the last one is at least [VERSION_INTERVAL_MS] old. A read-only file
 * is never written.
 *
 * The owner guards its contents with [lock], so changes and saves never interleave, and calls
 * [changed] with it held after each change.
 * [snapshot] is called with [lock] held, so it should only copy; [encode] runs outside it.
 */
internal class AutoSave<T>(
    private val file: Path,
    private val clock: Clock,
    private val listener: SaveListener,
    private val readOnly: Boolean,
    private val snapshot: () -> T,
    private val encode: (T) -> ByteArray,
) {
    /** The owner's lock: held for every change to its contents and while [snapshot] runs. */
    val lock = Any()

    private val fileName: String = file.fileName.toString()
    private val versions = VersionStore(file)

    // Held for a whole save, so two saves never write the temporary file at once.
    private val writing = Any()
    private var revision = 0L
    private var savedRevision = 0L
    private var pendingSave: Scheduled? = null
    private var currentStatus = SaveStatus.SAVED

    // Starts at open, whether or not there was a file to take a Version of. Guarded by [writing].
    private var lastVersionMs = clock.nowMs()

    val status: SaveStatus get() = synchronized(lock) { currentStatus }

    /**
     * Takes a Version of the file as it is on disk, for when it opens. Does nothing if there is no
     * file; a failure is reported to the listener and must not stop the file opening.
     */
    fun takeVersion() {
        takeVersion(clock.nowMs())
    }

    /** Call with [lock] held, after the owner's contents changed: schedules a save. */
    fun changed() {
        revision++
        scheduleSave(SAVE_DELAY_MS)
        if (currentStatus != SaveStatus.FAILED) setStatus(SaveStatus.PENDING)
    }

    /** Saves any changes now, for when the app goes to the background or the file closes. */
    fun saveNow() {
        synchronized(lock) {
            pendingSave?.cancel()
            pendingSave = null
        }
        save()
    }

    private fun save() {
        if (readOnly) return
        synchronized(writing) {
            val changes = synchronized(lock) { (snapshot() to revision).takeIf { revision != savedRevision } }
            changes?.let { (contents, savingRevision) ->
                val now = clock.nowMs()
                // A failed Version is retried at the next save.
                if (now - lastVersionMs >= VERSION_INTERVAL_MS && takeVersion(now)) lastVersionMs = now
                write(contents, savingRevision)
            }
        }
    }

    private fun write(
        contents: T,
        savingRevision: Long,
    ) {
        val started = clock.nowMs()
        val bytes = encode(contents)
        val failure =
            try {
                writeSafely(file, bytes)
                null
            } catch (e: IOException) {
                e
            } catch (e: SecurityException) {
                e
            }
        if (failure != null) {
            synchronized(lock) {
                scheduleSave(RETRY_DELAY_MS)
                setStatus(SaveStatus.FAILED)
            }
            listener.saveFailed(InkSaveFailed(fileName, failure))
        } else {
            synchronized(lock) {
                savedRevision = savingRevision
                setStatus(if (savedRevision == revision) SaveStatus.SAVED else SaveStatus.PENDING)
            }
            listener.saved(fileName, bytes.size, clock.nowMs() - started)
        }
    }

    // True if the Version was taken; a failure is reported and must not stop the file opening or saving.
    private fun takeVersion(nowMs: Long): Boolean =
        try {
            versions.take(nowMs)
            true
        } catch (e: IOException) {
            listener.versionFailed(VersionFailed(fileName, e))
            false
        } catch (e: SecurityException) {
            listener.versionFailed(VersionFailed(fileName, e))
            false
        }

    // Call with [lock] held.
    private fun scheduleSave(delayMs: Long) {
        pendingSave?.cancel()
        pendingSave = clock.schedule(delayMs) { save() }
    }

    // Call with [lock] held.
    private fun setStatus(status: SaveStatus) {
        if (status == currentStatus) return
        currentStatus = status
        listener.statusChanged(status)
    }

    companion object {
        /** A save happens this long after the last change: soon enough that a force-close loses little. */
        const val SAVE_DELAY_MS = 2_000L

        /** A failed save is tried again this often until it works. */
        const val RETRY_DELAY_MS = 5_000L

        /** While changing, a Version is taken at most this often. */
        const val VERSION_INTERVAL_MS = 15 * 60_000L
    }
}
