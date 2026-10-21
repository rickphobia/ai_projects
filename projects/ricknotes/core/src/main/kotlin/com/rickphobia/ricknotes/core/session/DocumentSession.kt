package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.inkfile.InkFile
import com.rickphobia.ricknotes.core.inkfile.InkFileCodec
import com.rickphobia.ricknotes.core.inkfile.InkFileDamaged
import com.rickphobia.ricknotes.core.inkfile.InkPage
import java.io.IOException
import java.nio.file.Path

/** Something the student should be told about when a Document opens. */
sealed interface SessionWarning {
    /** The PDF has [nowPages] pages but had [recordedPages] when its ink was last saved: ink may not line up. */
    data class PdfPageCountChanged(
        val recordedPages: Int,
        val nowPages: Int,
    ) : SessionWarning

    /** The Ink file can't be read, so the Document is open read-only and the file is left alone. */
    data class InkFileUnreadable(
        val error: InkFileDamaged,
    ) : SessionWarning
}

enum class SaveStatus {
    /** Everything drawn is in the Ink file. */
    SAVED,

    /** There are changes a save is scheduled for. */
    PENDING,

    /** The last save failed: changes are only in memory until a retry succeeds. Shown as "Not saved". */
    FAILED,
}

/** A save that didn't reach the Ink file; the old file is untouched and the changes are kept. */
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
 * One open Document's ink: the seam the screen talks to (spec, Seam 1). It loads the Ink file
 * beside the PDF, keeps the strokes, and saves [SAVE_DELAY_MS] after the last change or at once on
 * [saveNow]. It takes a Version of the Ink file on open and, while ink is being added, before the
 * first save at least [VERSION_INTERVAL_MS] after the last one. It may be called from any thread.
 *
 * It is the one seam for every change to a Document's ink, so its operations stay together even
 * past detekt's function count; the rest are the few steps of saving, which share its lock.
 */
@Suppress("TooManyFunctions")
class DocumentSession private constructor(
    private val store: InkFileStore,
    private val clock: Clock,
    private val listener: SaveListener,
    loaded: InkFile,
    pdfPageCount: Int,
    val warnings: List<SessionWarning>,
) {
    /** True when the Ink file couldn't be read: nothing may be drawn and nothing is ever saved. */
    val readOnly: Boolean = warnings.any { it is SessionWarning.InkFileUnreadable }

    private val versions = VersionStore(store.inkFile)
    private val lock = Any()

    // Held for a whole save, so two saves never write the temporary file at once.
    private val writing = Any()
    private val pageCount = pdfPageCount
    private val pages: List<InkPage> = loaded.pages + InkFile.pdfPages(pdfPageCount).filter { it !in loaded.pages }
    private val history = StrokeHistory(loaded.strokes)
    private var revision = 0L
    private var savedRevision = 0L
    private var pendingSave: Scheduled? = null
    private var currentStatus = SaveStatus.SAVED

    // Starts at open, whether or not there was an Ink file to take a Version of. Guarded by [writing].
    private var lastVersionMs = clock.nowMs()

    val strokes: List<Stroke> get() = synchronized(lock) { history.strokes }

    val status: SaveStatus get() = synchronized(lock) { currentStatus }

    val canUndo: Boolean get() = synchronized(lock) { history.canUndo }

    val canRedo: Boolean get() = synchronized(lock) { history.canRedo }

    fun addStroke(stroke: Stroke) {
        check(!readOnly) { "${store.fileName} is open read-only" }
        edit { history.add(stroke) }
    }

    /** Removes the strokes with these IDs, as one undo step; IDs of strokes that aren't here are ignored. */
    fun eraseStrokes(ids: Set<StrokeId>) {
        check(!readOnly) { "${store.fileName} is open read-only" }
        edit { history.erase(ids) }
    }

    /**
     * Moves the strokes with these IDs by [offset], as one undo step: a Lasso drag. IDs of strokes
     * that aren't here are ignored; returns false, with no undo step, if nothing moved.
     */
    fun moveStrokes(
        ids: Set<StrokeId>,
        offset: PageOffset,
    ): Boolean {
        check(!readOnly) { "${store.fileName} is open read-only" }
        return edit { history.move(ids, offset) }
    }

    /** Takes back the last change, or returns false if there is none. Saved like any change. */
    fun undo(): Boolean = edit { history.undo() }

    /** Makes the last undone change again, or returns false if there is none. Saved like any change. */
    fun redo(): Boolean = edit { history.redo() }

    // Makes a change to the strokes and, if [change] says it changed anything, schedules a save.
    private fun edit(change: () -> Boolean): Boolean =
        synchronized(lock) {
            change().also { changed ->
                if (changed) {
                    revision++
                    scheduleSave(SAVE_DELAY_MS)
                    if (currentStatus != SaveStatus.FAILED) setStatus(SaveStatus.PENDING)
                }
            }
        }

    /** Saves any changes now, for when the app goes to the background or the Document closes. */
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
            val changes =
                synchronized(lock) {
                    (InkFile(pageCount, pages, history.strokes) to revision).takeIf { revision != savedRevision }
                }
            changes?.let { (file, savingRevision) ->
                val now = clock.nowMs()
                // A failed Version is retried at the next save.
                if (now - lastVersionMs >= VERSION_INTERVAL_MS &&
                    takeVersion(versions, store.fileName, now, listener)
                ) {
                    lastVersionMs = now
                }
                write(file, savingRevision)
            }
        }
    }

    private fun write(
        file: InkFile,
        savingRevision: Long,
    ) {
        val started = clock.nowMs()
        val bytes = InkFileCodec.encode(file).toByteArray(Charsets.UTF_8)
        val failure =
            try {
                store.write(bytes)
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
            listener.saveFailed(InkSaveFailed(store.fileName, failure))
        } else {
            synchronized(lock) {
                savedRevision = savingRevision
                setStatus(if (savedRevision == revision) SaveStatus.SAVED else SaveStatus.PENDING)
            }
            listener.saved(store.fileName, bytes.size, clock.nowMs() - started)
        }
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

        /** While writing, a Version is taken at most this often. */
        const val VERSION_INTERVAL_MS = 15 * 60_000L

        /**
         * Opens the ink of the Document at [pdf], which has [pdfPageCount] pages. A missing Ink file
         * starts empty; an unreadable one opens read-only with a warning.
         */
        fun open(
            pdf: Path,
            pdfPageCount: Int,
            clock: Clock,
            listener: SaveListener = object : SaveListener {},
        ): DocumentSession {
            val store = InkFileStore(pdf)
            val loaded =
                try {
                    load(store)
                } catch (e: InkFileDamaged) {
                    // No Version of a damaged file: it would push a good Version out of the newest 10.
                    return readOnly(store, clock, listener, pdfPageCount, e)
                }
            if (loaded != null) takeVersion(VersionStore(store.inkFile), store.fileName, clock.nowMs(), listener)
            val warnings =
                listOfNotNull(
                    loaded?.takeIf { it.pdfPageCount != pdfPageCount }?.let {
                        SessionWarning.PdfPageCountChanged(it.pdfPageCount, pdfPageCount)
                    },
                )
            val start = loaded ?: InkFile.empty(pdfPageCount)
            return DocumentSession(store, clock, listener, start, pdfPageCount, warnings)
        }

        /** The Ink file's contents, or null if there is none. */
        private fun load(store: InkFileStore): InkFile? {
            val fileName = store.fileName
            val text =
                try {
                    store.read()
                } catch (e: IOException) {
                    throw InkFileDamaged(fileName, "can't read it", e)
                }
            return text?.let { InkFileCodec.decode(it, fileName) }
        }

        /** True if the Version was taken; a failure is reported and must not stop the Document opening or saving. */
        private fun takeVersion(
            versions: VersionStore,
            fileName: String,
            nowMs: Long,
            listener: SaveListener,
        ): Boolean =
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

        private fun readOnly(
            store: InkFileStore,
            clock: Clock,
            listener: SaveListener,
            pdfPageCount: Int,
            error: InkFileDamaged,
        ) = DocumentSession(
            store,
            clock,
            listener,
            InkFile.empty(pdfPageCount),
            pdfPageCount,
            listOf(SessionWarning.InkFileUnreadable(error)),
        )
    }
}
