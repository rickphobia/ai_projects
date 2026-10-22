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

/**
 * One open Document's ink: the seam the screen talks to (spec, Seam 1). It loads the Ink file
 * beside the PDF, keeps the strokes, and saves them through an [AutoSave]: [SAVE_DELAY_MS] after
 * the last change or at once on [saveNow], with a Version of the Ink file on open and, while ink is
 * being added, before the first save at least [VERSION_INTERVAL_MS] after the last one. It may be
 * called from any thread.
 *
 * It is the one seam for every change to a Document's ink, so its operations stay together even
 * past detekt's function count.
 */
@Suppress("TooManyFunctions")
class DocumentSession private constructor(
    private val store: InkFileStore,
    clock: Clock,
    listener: SaveListener,
    loaded: InkFile,
    pdfPageCount: Int,
    val warnings: List<SessionWarning>,
) {
    /** True when the Ink file couldn't be read: nothing may be drawn and nothing is ever saved. */
    val readOnly: Boolean = warnings.any { it is SessionWarning.InkFileUnreadable }

    private val pageCount = pdfPageCount
    private val pages: List<InkPage> = loaded.pages + InkFile.pdfPages(pdfPageCount).filter { it !in loaded.pages }
    private val history = StrokeHistory(loaded.strokes)
    private val saving =
        AutoSave(
            store.inkFile,
            clock,
            listener,
            readOnly,
            snapshot = { InkFile(pageCount, pages, history.strokes) },
        ) { InkFileCodec.encode(it).toByteArray(Charsets.UTF_8) }
    private val lock = saving.lock

    val strokes: List<Stroke> get() = synchronized(lock) { history.strokes }

    val status: SaveStatus get() = saving.status

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
            change().also { changed -> if (changed) saving.changed() }
        }

    /** Saves any changes now, for when the app goes to the background or the Document closes. */
    fun saveNow() = saving.saveNow()

    companion object {
        const val SAVE_DELAY_MS = AutoSave.SAVE_DELAY_MS
        const val RETRY_DELAY_MS = AutoSave.RETRY_DELAY_MS
        const val VERSION_INTERVAL_MS = AutoSave.VERSION_INTERVAL_MS

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
            val warnings =
                listOfNotNull(
                    loaded?.takeIf { it.pdfPageCount != pdfPageCount }?.let {
                        SessionWarning.PdfPageCountChanged(it.pdfPageCount, pdfPageCount)
                    },
                )
            val start = loaded ?: InkFile.empty(pdfPageCount)
            return DocumentSession(store, clock, listener, start, pdfPageCount, warnings).also {
                if (loaded != null) it.saving.takeVersion()
            }
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
