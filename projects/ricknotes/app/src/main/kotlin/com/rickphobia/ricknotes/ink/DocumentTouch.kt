package com.rickphobia.ricknotes.ink

import android.graphics.Matrix
import android.graphics.Path
import android.view.MotionEvent
import android.view.View
import androidx.ink.authoring.InProgressStrokeId
import androidx.ink.authoring.InProgressStrokesFinishedListener
import androidx.ink.authoring.InProgressStrokesView
import androidx.ink.strokes.StrokeInput
import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.core.ink.PagePoint
import com.rickphobia.ricknotes.core.ink.ScreenPoint
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.ink.pageAt
import com.rickphobia.ricknotes.core.touch.TouchAction
import com.rickphobia.ricknotes.logging.AppLog
import java.util.UUID
import androidx.ink.strokes.Stroke as InkStroke

// How long a finished stroke may stay in the wet layer waiting for its page to draw it. Long enough
// for a slow frame, short enough that a stroke whose page scrolled away doesn't linger on screen.
private const val HANDOFF_TIMEOUT_MS = 250L

/** What the touch layer asks of the page list when fingers move it. */
internal interface TouchNavigation {
    /** Fingers or the pen touched down: stop any fling. */
    fun stop()

    fun scroll(action: TouchAction.Scroll)

    fun pinch(action: TouchAction.Pinch)

    fun scrollEnd()
}

/**
 * Carries out what `core`'s touch interpreter makes of each touch on an open Document. The pen's
 * strokes, with whichever [penMode] is picked when each starts, are drawn by Jetpack Ink's
 * low-latency [InProgressStrokesView] in page coordinates, and handed to [ink] once finished, which
 * draws them with their page from then on and saves them. In [PenMode.Erase] the pen instead erases
 * every stroke it touches on the page it went down on, as one undo step per gesture (a finger does the
 * same with Finger erase on), and in [PenMode.Lasso] it works [DocumentInk.lasso]. Neither pen nor
 * finger does anything on a read-only Document.
 */
internal class DocumentTouch(
    private val inProgress: InProgressStrokesView,
    private val ink: DocumentInk,
    private val placements: () -> List<PagePlacement>,
    private val navigation: TouchNavigation,
    private val clockMs: () -> Long,
    private val penMode: () -> PenMode,
) : InProgressStrokesFinishedListener {
    // Strokes the pen is drawing, by pointer, and what each will need once Ink hands it back.
    private val drawing = mutableMapOf<Int, InProgressStrokeId>()
    private val started = mutableMapOf<InProgressStrokeId, StartedStroke>()
    private val handoff = WetInkHandoff<InProgressStrokeId>(inProgress::removeFinishedStrokes)
    private val eraser = StrokeEraser(ink, placements)
    private val fingers = FingerTouch(ink, placements, navigation, eraser)

    // The page each Lasso gesture went down on, by pointer: a loop or drag stays on that page.
    private val lassos = mutableMapOf<Int, PageId>()

    private data class StartedStroke(
        val pageId: PageId,
        val tool: InkTool,
        val drawnAtMs: Long,
    )

    /** Does what [action] says; [event] is the Android event it came from. */
    fun carryOut(
        view: View,
        event: MotionEvent,
        action: TouchAction,
    ) {
        when (action) {
            is TouchAction.StartStroke -> start(view, event, action)
            is TouchAction.ExtendStroke -> extend(event, action)
            is TouchAction.EndStroke -> end(event, action.pointerId)
            is TouchAction.CancelStroke -> cancel(event, action.pointerId)
            else -> fingers.carryOut(action)
        }
    }

    private fun start(
        view: View,
        event: MotionEvent,
        action: TouchAction.StartStroke,
    ) {
        navigation.stop()
        eraser.cancelAll()
        if (ink.readOnly) {
            AppLog.d("pen down on a read-only Document; no stroke")
            return
        }
        val page = pageAt(placements(), ScreenPoint(action.x, action.y))
        if (page == null) {
            AppLog.d("pen down outside any page; no stroke")
            // A tap beside the pages is outside any Lasso selection too.
            ink.lasso.clear()
            return
        }
        when (val mode = penMode()) {
            PenMode.Erase -> {
                eraser.start(action.pointerId, page, ScreenPoint(action.x, action.y))
            }

            // The Lasso follows one pointer at a time: a second would tangle its loop or drag.
            PenMode.Lasso -> {
                if (lassos.isEmpty()) {
                    lassos[action.pointerId] = page.pageId
                    ink.lasso.down(page, page.toPage(ScreenPoint(action.x, action.y)))
                }
            }

            is PenMode.Draw -> {
                startDrawing(view, event, action.pointerId, page, mode.tool)
            }
        }
    }

    private fun startDrawing(
        view: View,
        event: MotionEvent,
        pointerId: Int,
        page: PagePlacement,
        tool: InkTool,
    ) {
        // Without this Android batches pen samples once per frame, which the pen tip shows as lag.
        view.requestUnbufferedDispatch(event)
        // A finished stroke is cut off at its page's edge, so the wet one is too: no tail that
        // vanishes on pen up.
        inProgress.maskPath = outside(page, view.width.toFloat(), view.height.toFloat())
        val brush = inkBrush(tool.tool, tool.colourArgb, tool.widthPt)
        val id = inProgress.startStroke(event, pointerId, brush, page.screenToPage())
        drawing[pointerId] = id
        started[id] = StartedStroke(page.pageId, tool, clockMs())
    }

    private fun extend(
        event: MotionEvent,
        action: TouchAction.ExtendStroke,
    ) {
        drawing[action.pointerId]?.let { inProgress.addToStroke(event, action.pointerId, it) }
        lassos[action.pointerId]?.let { pageId ->
            placements().firstOrNull { it.pageId == pageId }?.let { page ->
                ink.lasso.moveTo(page, page.toPage(ScreenPoint(action.x, action.y)))
            }
        }
        eraser.extend(action.pointerId, ScreenPoint(action.x, action.y))
    }

    private fun end(
        event: MotionEvent,
        pointerId: Int,
    ) {
        drawing.remove(pointerId)?.let { inProgress.finishStroke(event, pointerId, it) }
        eraser.end(pointerId)
        if (lassos.remove(pointerId) != null) ink.lasso.up()
    }

    private fun cancel(
        event: MotionEvent,
        pointerId: Int,
    ) {
        eraser.cancel(pointerId)
        if (lassos.remove(pointerId) != null) ink.lasso.cancel()
        val id = drawing.remove(pointerId) ?: return
        started.remove(id)
        inProgress.cancelStroke(id, event)
    }

    override fun onStrokesFinished(strokes: Map<InProgressStrokeId, InkStroke>) {
        for ((id, mesh) in strokes) {
            val start = started.remove(id)
            if (start != null && !mesh.inputs.isEmpty()) {
                handOver(id, mesh, start)
            } else {
                start?.let { AppLog.w("dropped a stroke with no points on page ${it.pageId.value}") }
                inProgress.removeFinishedStrokes(setOf(id))
            }
        }
    }

    /** Gives a finished stroke to its page, and takes it out of the wet layer once the page has drawn it. */
    private fun handOver(
        id: InProgressStrokeId,
        mesh: InkStroke,
        start: StartedStroke,
    ) {
        // Posted, so it runs after the page's draw and the wet copy is gone from the next frame.
        ink.add(DrawnStroke(mesh.toStroke(start), mesh) { inProgress.post { handoff.drawnByPage(id) } })
        handoff.handedOff(id)
        inProgress.postDelayed({ handoff.timedOut(id) }, HANDOFF_TIMEOUT_MS)
    }

    private fun InkStroke.toStroke(start: StartedStroke): Stroke {
        val input = StrokeInput()
        val points =
            List(inputs.size) { index ->
                inputs.populate(index, input)
                val pressure = if (input.hasPressure) input.pressure.coerceIn(0f, 1f) else 1f
                StrokePoint(input.x, input.y, pressure, input.elapsedTimeMillis)
            }
        return Stroke(
            id = StrokeId(UUID.randomUUID().toString()),
            pageId = start.pageId,
            tool = start.tool.tool,
            colourArgb = start.tool.colourArgb,
            widthPt = start.tool.widthPt,
            drawnAtMs = start.drawnAtMs,
            points = points,
        )
    }
}

/** Everything on a [width] x [height] screen except the page: where wet ink is hidden. */
private fun outside(
    page: PagePlacement,
    width: Float,
    height: Float,
): Path {
    val corner = page.toScreen(PagePoint(0f, 0f))
    val far = page.toScreen(PagePoint(page.widthPt, page.heightPt))
    return Path().apply {
        fillType = Path.FillType.EVEN_ODD
        addRect(0f, 0f, width, height, Path.Direction.CW)
        addRect(corner.x, corner.y, far.x, far.y, Path.Direction.CW)
    }
}

/** The same mapping as [PagePlacement.toPage], as a matrix for Jetpack Ink. */
private fun PagePlacement.screenToPage(): Matrix =
    Matrix().apply {
        setTranslate(-left, -top)
        postScale(1f / pixelsPerPoint, 1f / pixelsPerPoint)
    }
