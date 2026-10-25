package com.rickphobia.ricknotes.ink

import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.ink.brush.Brush
import androidx.ink.brush.InputToolType
import androidx.ink.brush.StockBrushes
import androidx.ink.strokes.MutableStrokeInputBatch
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.PictureFrame
import com.rickphobia.ricknotes.core.ink.PictureId
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.Tool
import com.rickphobia.ricknotes.core.inkfile.InkPage
import com.rickphobia.ricknotes.core.session.PageOffset
import com.rickphobia.ricknotes.core.session.SaveStatus
import com.rickphobia.ricknotes.core.session.SessionWarning
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import androidx.ink.strokes.Stroke as InkStroke

// The smallest detail a stroke's outline keeps, in PDF points. A page is drawn 4 to 20 px per point
// (1x to 5x), so this is under half a pixel even at 5x.
private const val EPSILON_PT = 0.02f

/** The brush a Stroke of [tool], [colourArgb] and [widthPt] is drawn with, wet or saved. */
internal fun inkBrush(
    tool: Tool,
    colourArgb: Int,
    widthPt: Float,
): Brush {
    val family =
        when (tool) {
            Tool.PEN -> StockBrushes.pressurePen()
            Tool.HIGHLIGHTER -> StockBrushes.highlighter()
        }
    return Brush.createWithColorIntArgb(family, colourArgb, widthPt, EPSILON_PT)
}

/**
 * A finished Stroke, with the mesh Jetpack Ink built for it so it isn't rebuilt every frame.
 * [onFirstDraw] runs once, after its page has drawn it for the first time.
 */
internal class DrawnStroke(
    val stroke: Stroke,
    val mesh: InkStroke,
    private var onFirstDraw: (() -> Unit)? = null,
) {
    fun drawn() {
        val firstDraw = onFirstDraw ?: return
        onFirstDraw = null
        firstDraw()
    }
}

/**
 * The ink of one open Document: its strokes and Pictures for drawing, kept in `core`'s Document
 * session, which saves them to the Ink file beside [pdf] and keeps their undo history. [saveStatus]
 * follows the session, so the screen can show "Not saved".
 *
 * It is the screen's one way to change a Document's ink, so its operations stay together even past
 * detekt's function count.
 */
@Suppress("TooManyFunctions")
internal class DocumentInk private constructor(
    private val pdf: File,
    private val held: HeldSession,
    loaded: List<DrawnStroke>,
) {
    private val session = held.session
    private val strokes = mutableStateListOf<DrawnStroke>().apply { addAll(loaded) }
    private val pictures = mutableStateListOf<Picture>().apply { addAll(session.pictures) }
    private val pageList = mutableStateListOf<InkPage>().apply { addAll(session.pages) }

    /** Every page in the order it shows, Inserted pages included. */
    val pages: List<InkPage> get() = pageList

    // Counts changes, so Compose reads canUndo and canRedo again after each one.
    private val changes = mutableIntStateOf(0)

    // The session's revision these strokes and Pictures match.
    private var drawnRevision = held.revision.intValue

    /** The session's revision: it moves on whenever any Tab of the Document changes its ink. */
    val revision: Int get() = held.revision.intValue

    /** True while nothing may be drawn: an unreadable Ink file, or a [conflictCopy] not yet resolved. */
    val readOnly: Boolean get() = changes.intValue.let { session.readOnly }

    /** The sync app's Conflict copy of the Ink file to choose about before writing, or null. */
    val conflictCopy: String? get() = changes.intValue.let { session.conflictCopy }

    /** The background printed into this Document if the app made it as a Notebook, else null. */
    val notebook: PageBackground? get() = session.notebook
    val assetsFolder: File get() = session.assetsFolder.toFile()
    val warnings: List<SessionWarning> get() = session.warnings
    val saveStatus: SaveStatus get() = held.status.current.value
    val canUndo: Boolean get() = changes.intValue.let { session.canUndo }
    val canRedo: Boolean get() = changes.intValue.let { session.canRedo }

    val eraser: EraserTool by lazy { EraserTool(this) }
    val lasso: LassoTool by lazy { LassoTool(this) }

    fun add(stroke: DrawnStroke) {
        session.addStroke(stroke.stroke)
        strokes.add(stroke)
        changed()
    }

    /** Removes the strokes with these IDs, as one undo step. */
    fun delete(ids: Set<StrokeId>) {
        session.eraseStrokes(ids)
        strokes.removeAll { it.stroke.id in ids }
        changed()
    }

    /** Moves the strokes with these IDs by [offset], as one undo step; false if none of them is here. */
    fun move(
        ids: Set<StrokeId>,
        offset: PageOffset,
    ): Boolean = session.moveStrokes(ids, offset).also { moved -> if (moved) followSession() }

    /** Moves or resizes the Picture [id] to [frame], as one undo step; false if nothing changed. */
    fun reframe(
        id: PictureId,
        frame: PictureFrame,
    ): Boolean = session.reframePicture(id, frame).also { changed -> if (changed) followSession() }

    /** Takes the Picture [id] off its page, as one undo step. Its image stays in `.assets`. */
    fun deletePicture(id: PictureId) {
        if (session.deletePicture(id)) followSession() else AppLog.w("delete of Picture ${id.value}, which isn't here")
    }

    /**
     * Copies [image] into the Document's `.assets` folder and places it on [pageId] at [frame], as
     * one undo step. The copy runs off the main thread.
     *
     * @throws com.rickphobia.ricknotes.core.session.PictureNotPlaced if the image can't be copied.
     */
    suspend fun place(
        image: File,
        extension: String,
        pageId: PageId,
        frame: PictureFrame,
    ): Picture {
        val picture = withContext(Dispatchers.IO) { session.placePicture(image.toPath(), extension, pageId, frame) }
        followSession()
        return picture
    }

    /** Adds an Inserted page with [background] after page [after], as one undo step. */
    fun insertPageAfter(
        after: PageId,
        background: PageBackground,
    ): InkPage =
        session.insertPageAfter(after, background).also {
            AppLog.i("inserted a ${background.name.lowercase()} page after ${after.value} in ${pdf.name}")
            followSession()
        }

    /** Adds an Inserted page with the Notebook's background after the last page; null if this isn't a Notebook. */
    fun addNotebookPage(): InkPage? = notebook?.let { insertPageAfter(pageList.last().id, it) }

    /** True if page [id] has strokes or Pictures, so removing it asks first. */
    fun hasInk(id: PageId): Boolean = session.hasInk(id)

    /** Removes the Inserted page [id] with its ink, as one undo step; undo brings them back. */
    fun removePage(id: PageId) {
        lasso.clear()
        if (session.removePage(id)) {
            AppLog.i("removed page ${id.value} from ${pdf.name}")
            followSession()
        } else {
            AppLog.w("remove of page ${id.value}, which isn't here")
        }
    }

    // A selection may hold strokes that an undo or redo takes away, so it is let go of.
    fun undo() {
        lasso.clear()
        if (session.undo()) followSession() else AppLog.w("undo with nothing to undo")
    }

    fun redo() {
        lasso.clear()
        if (session.redo()) followSession() else AppLog.w("redo with nothing to redo")
    }

    /**
     * Keeps this tablet's ink and moves the Conflict copy into Versions, off the main thread.
     *
     * @throws com.rickphobia.ricknotes.core.session.ConflictNotResolved if it can't be moved.
     */
    suspend fun keepMine() = resolveConflict("kept mine; the Conflict copy went into Versions", session::keepMine)

    /**
     * Puts the Conflict copy in place of the Ink file and moves the Ink file into Versions, off the
     * main thread.
     *
     * @throws com.rickphobia.ricknotes.core.session.ConflictNotResolved if it can't be read or moved.
     */
    suspend fun keepTheOther() =
        resolveConflict("kept the other; the Ink file went into Versions", session::keepTheOther)

    private suspend fun resolveConflict(
        outcome: String,
        resolve: () -> Unit,
    ) {
        val copy = session.conflictCopy ?: return
        withContext(Dispatchers.IO) { resolve() }
        AppLog.i("${pdf.name}: Conflict copy $copy: $outcome")
        followSession()
    }

    /** The page's Pictures, drawn under its strokes in this order. */
    fun picturesOn(pageId: PageId): List<Picture> = pictures.filter { it.pageId == pageId }

    /** The page's strokes in drawing order: highlighter first, so it sits under the pen's writing. */
    fun on(pageId: PageId): List<DrawnStroke> =
        strokes
            .filter { it.stroke.pageId == pageId && !eraser.hides(it.stroke.id) }
            .sortedBy { it.stroke.tool != Tool.HIGHLIGHTER }

    // After this Tab's own undo, redo, move, placing or delete: draws the session's ink, which now
    // holds every Tab's changes.
    private fun followSession() {
        redraw()
        held.revision.intValue++
        drawnRevision = held.revision.intValue
    }

    /**
     * Draws what another Tab of the Document changed. Its selection may hold strokes that changed,
     * so it is let go of.
     */
    fun catchUp() {
        if (drawnRevision == held.revision.intValue) return
        lasso.clear()
        redraw()
        drawnRevision = held.revision.intValue
    }

    // After this Tab added or erased strokes itself. If another Tab's change isn't drawn yet, this
    // Tab stays behind, so catchUp still draws it.
    private fun changed() {
        val current = drawnRevision == held.revision.intValue
        held.revision.intValue++
        if (current) drawnRevision = held.revision.intValue
        changes.intValue++
    }

    // Matches the drawn strokes and Pictures to the session's, keeping the meshes already built of
    // strokes that haven't moved.
    private fun redraw() {
        val built = strokes.associateBy { it.stroke.id }
        val now =
            session.strokes.mapNotNull { stroke ->
                built[stroke.id]?.takeIf { it.stroke == stroke }
                    ?: stroke.toMesh()?.let { DrawnStroke(stroke, it) }
            }
        strokes.clear()
        strokes.addAll(now)
        pictures.clear()
        pictures.addAll(session.pictures)
        // Only when they changed: a new page list lays every page out again.
        val nowPages = session.pages
        if (nowPages != pageList.toList()) {
            pageList.clear()
            pageList.addAll(nowPages)
        }
        changes.intValue++
    }

    /** Saves on the save thread without waiting: for when the app goes to the background. */
    fun saveInBackground() = SaveThread.run(session::saveNow)

    /** Saves what is left; the session keeps retrying after this if that save fails. */
    fun close() = InkSessions.close(pdf)

    companion object {
        /** Opens the ink beside [pdf] and builds every stroke's mesh. Slow: call it off the main thread. */
        fun open(
            pdf: File,
            pageCount: Int,
        ): DocumentInk {
            val held = InkSessions.open(pdf, pageCount)
            val strokes = held.session.strokes
            AppLog.i("loaded ${strokes.size} strokes for ${pdf.name}")
            return DocumentInk(
                pdf,
                held,
                strokes.mapNotNull { stroke ->
                    stroke.toMesh()?.let { DrawnStroke(stroke, it) }
                },
            )
        }
    }
}

/**
 * Rebuilds the mesh of a saved Stroke from its points, as Jetpack Ink drew it when it was wet, or
 * null if Ink rejects them: one stroke that can't be drawn must not keep the Document from opening.
 * It stays in the Ink file either way. Ink's native code reports a rejected input as an
 * IllegalArgumentException, IllegalStateException or plain RuntimeException depending on the check,
 * so all of them are caught.
 */
@Suppress("TooGenericExceptionCaught")
internal fun Stroke.toMesh(): InkStroke? =
    try {
        val inputs = MutableStrokeInputBatch()
        addTo(inputs)
        InkStroke(inkBrush(tool, colourArgb, widthPt), inputs)
    } catch (e: RuntimeException) {
        AppLog.e("can't draw saved stroke ${id.value} on page ${pageId.value}; it is kept but not shown", e)
        null
    }

private fun Stroke.addTo(inputs: MutableStrokeInputBatch) {
    for (point in inkInputPoints(points)) {
        inputs.add(
            type = InputToolType.STYLUS,
            x = point.x,
            y = point.y,
            elapsedTimeMillis = point.elapsedMs,
            pressure = point.pressure,
        )
    }
}
