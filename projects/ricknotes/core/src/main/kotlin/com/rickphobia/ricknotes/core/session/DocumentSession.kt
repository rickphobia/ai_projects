package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.PictureFrame
import com.rickphobia.ricknotes.core.ink.PictureId
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.inkfile.InkFile
import com.rickphobia.ricknotes.core.inkfile.InkFileCodec
import com.rickphobia.ricknotes.core.inkfile.InkFileDamaged
import com.rickphobia.ricknotes.core.inkfile.InkPage
import java.io.IOException
import java.nio.file.Path
import java.util.UUID

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
 * beside the PDF, keeps the strokes and Pictures, and saves them through an [AutoSave]: [SAVE_DELAY_MS] after
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
    private val unreadable = warnings.any { it is SessionWarning.InkFileUnreadable }
    private val pageCount = pdfPageCount
    private val assets = PictureAssets(store.pdf)
    private val conflicts = InkConflicts(store, clock)

    // Guarded by [lock], like [pendingConflicts]. Replaced only by Keep the other.
    private var content = loaded
    private var history = historyOf(loaded)

    // The Conflict copies found on open, each dropped once resolved. An unreadable Ink file isn't
    // offered them: it is never written.
    private var pendingConflicts: List<Path> = if (unreadable) emptyList() else conflicts.pending()

    private val saving =
        AutoSave(
            store.inkFile,
            clock,
            listener,
            unreadable,
            snapshot = { InkFile(pageCount, history.pages, history.strokes, history.pictures, content.notebook) },
        ) { InkFileCodec.encode(it).toByteArray(Charsets.UTF_8) }
    private val lock = saving.lock

    /**
     * The file name of the sync app's Conflict copy of the Ink file, which must be resolved with
     * [keepMine] or [keepTheOther] before anything is written, or null if there is none.
     */
    val conflictCopy: String? get() = synchronized(lock) { pendingConflicts.firstOrNull()?.fileName?.toString() }

    /**
     * True when nothing may be drawn: the Ink file couldn't be read (it is then never saved), or it
     * has a [conflictCopy] still to resolve.
     */
    val readOnly: Boolean get() = unreadable || conflictCopy != null

    /** The background printed into this Document's pages if the app made it as a Notebook, else null. */
    val notebook: PageBackground? get() = synchronized(lock) { content.notebook }

    /** Every page in the order it shows: the PDF's own pages with any Inserted pages between them. */
    val pages: List<InkPage> get() = synchronized(lock) { history.pages }

    val strokes: List<Stroke> get() = synchronized(lock) { history.strokes }

    /** The Pictures on every page, in drawing order: a later one is drawn over an earlier one. */
    val pictures: List<Picture> get() = synchronized(lock) { history.pictures }

    /** The folder that holds the Pictures' images: a Picture's image is `assetsFolder/imageFile`. */
    val assetsFolder: Path get() = assets.folder

    val status: SaveStatus get() = saving.status

    val canUndo: Boolean get() = synchronized(lock) { history.canUndo }

    val canRedo: Boolean get() = synchronized(lock) { history.canRedo }

    fun addStroke(stroke: Stroke) {
        checkWritable()
        edit { history.add(stroke) }
    }

    /** Removes the strokes with these IDs, as one undo step; IDs of strokes that aren't here are ignored. */
    fun eraseStrokes(ids: Set<StrokeId>) {
        checkWritable()
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
        checkWritable()
        return edit { history.move(ids, offset) }
    }

    /**
     * Copies [image] into the Document's `.assets` folder under a new name ending in [extension]
     * (such as "png"), then places it on page [pageId] at [frame], as one undo step. The copy is
     * there before the Ink file can refer to it, and [image] itself is never changed.
     *
     * @throws PictureNotPlaced if the image can't be copied; nothing is placed then.
     */
    fun placePicture(
        image: Path,
        extension: String,
        pageId: PageId,
        frame: PictureFrame,
    ): Picture {
        checkWritable()
        require(pages.any { it.id == pageId }) { "page ${pageId.value} is not in ${store.fileName}" }
        val id = UUID.randomUUID().toString()
        val name = "$id.$extension"
        // Copied outside the lock: a large image must not hold up the pen.
        assets.copyIn(image, name)
        val picture = Picture(PictureId(id), pageId, name, frame.left, frame.top, frame.widthPt, frame.heightPt)
        edit { history.place(picture) }
        return picture
    }

    /**
     * Moves or resizes the Picture [id] to [frame], as one undo step. The caller keeps it on its page
     * and its shape (see `resizedPicture`). Returns false, with no undo step, if it isn't here or is
     * there already.
     */
    fun reframePicture(
        id: PictureId,
        frame: PictureFrame,
    ): Boolean {
        checkWritable()
        return edit { history.reframe(id, frame) }
    }

    /**
     * Takes the Picture [id] off its page, as one undo step; false if it isn't here. Its image stays
     * in `.assets`, so undo works and Versions still point at a real file.
     */
    fun deletePicture(id: PictureId): Boolean {
        checkWritable()
        return edit { history.delete(id) }
    }

    /**
     * Adds an Inserted page with [background] right after the page [after], as one undo step. It
     * lives only in the Ink file; the PDF is never changed.
     */
    fun insertPageAfter(
        after: PageId,
        background: PageBackground,
    ): InkPage {
        checkWritable()
        val page = InkPage(PageId("$INSERTED_PAGE_PREFIX${UUID.randomUUID()}"), background)
        edit { history.insertPage(page, after) }
        return page
    }

    /**
     * Removes the Inserted page [id] with its strokes and Pictures, as one undo step, so undo brings
     * them all back; false if it isn't here. Pictures' images stay in `.assets`.
     *
     * @throws IllegalArgumentException for one of the PDF's own pages, which can't be removed.
     */
    fun removePage(id: PageId): Boolean {
        checkWritable()
        return edit { history.removePage(id) }
    }

    /** True if page [id] has any strokes or Pictures on it: removing it then asks first. */
    fun hasInk(id: PageId): Boolean = synchronized(lock) { history.hasInk(id) }

    /**
     * Keep mine: moves the [conflictCopy] into Versions and keeps the ink as it is.
     *
     * @throws ConflictNotResolved if it can't be moved; nothing changes then.
     */
    fun keepMine(): Unit =
        synchronized(lock) {
            conflicts.keepMine(nextConflict())
            pendingConflicts = pendingConflicts.drop(1)
        }

    /**
     * Keep the other: puts the [conflictCopy] in place of the Ink file, after moving the Ink file into
     * Versions, and shows the copy's ink.
     *
     * @throws ConflictNotResolved if the copy can't be read or moved; the ink stays as it was then.
     */
    fun keepTheOther(): Unit =
        synchronized(lock) {
            content = conflicts.keepTheOther(nextConflict())
            history = historyOf(content)
            pendingConflicts = pendingConflicts.drop(1)
        }

    private fun nextConflict(): Path =
        checkNotNull(pendingConflicts.firstOrNull()) {
            "${store.fileName} has no Conflict copy"
        }

    private fun checkWritable() = check(!readOnly) { "${store.fileName} is open read-only" }

    // The undo history of [file], with no step to undo: every PDF page shows, whether it has ink or not.
    private fun historyOf(file: InkFile): InkHistory =
        InkHistory(
            InkContent(
                file.pages + InkFile.pdfPages(pageCount).filter { it !in file.pages },
                file.strokes,
                file.pictures,
            ),
        )

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

        // An Inserted page's ID is this and a random UUID, so it never clashes with `pdf-<number>`.
        private const val INSERTED_PAGE_PREFIX = "inserted-"

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
