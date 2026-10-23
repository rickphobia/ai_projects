package com.rickphobia.ricknotes.ink

import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.ink.brush.Brush
import androidx.ink.brush.InputToolType
import androidx.ink.brush.StockBrushes
import androidx.ink.strokes.MutableStrokeInputBatch
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.PictureFrame
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.Tool
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

    // Counts changes, so Compose reads canUndo and canRedo again after each one.
    private val changes = mutableIntStateOf(0)

    val readOnly: Boolean get() = session.readOnly
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
        changes.intValue++
    }

    /** Removes the strokes with these IDs, as one undo step. */
    fun delete(ids: Set<StrokeId>) {
        session.eraseStrokes(ids)
        strokes.removeAll { it.stroke.id in ids }
        changes.intValue++
    }

    /** Moves the strokes with these IDs by [offset], as one undo step; false if none of them is here. */
    fun move(
        ids: Set<StrokeId>,
        offset: PageOffset,
    ): Boolean = session.moveStrokes(ids, offset).also { moved -> if (moved) followSession() }

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

    // A selection may hold strokes that an undo or redo takes away, so it is let go of.
    fun undo() {
        lasso.clear()
        if (session.undo()) followSession() else AppLog.w("undo with nothing to undo")
    }

    fun redo() {
        lasso.clear()
        if (session.redo()) followSession() else AppLog.w("redo with nothing to redo")
    }

    /** The page's Pictures, drawn under its strokes in this order. */
    fun picturesOn(pageId: PageId): List<Picture> = pictures.filter { it.pageId == pageId }

    /** The page's strokes in drawing order: highlighter first, so it sits under the pen's writing. */
    fun on(pageId: PageId): List<DrawnStroke> =
        strokes
            .filter { it.stroke.pageId == pageId && !eraser.hides(it.stroke.id) }
            .sortedBy { it.stroke.tool != Tool.HIGHLIGHTER }

    // Matches the drawn strokes and Pictures to the session's after an undo, redo, move or placing,
    // keeping the meshes already built of strokes that haven't moved.
    private fun followSession() {
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
private fun Stroke.toMesh(): InkStroke? =
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
