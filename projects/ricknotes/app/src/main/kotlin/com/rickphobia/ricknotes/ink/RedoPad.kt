package com.rickphobia.ricknotes.ink

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Matrix
import android.view.MotionEvent
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.FrameLayout
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.graphics.withMatrix
import androidx.ink.authoring.InProgressStrokeId
import androidx.ink.authoring.InProgressStrokesFinishedListener
import androidx.ink.authoring.InProgressStrokesView
import androidx.ink.rendering.android.canvas.CanvasStrokeRenderer
import androidx.ink.strokes.StrokeInput
import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.ink.StrokePoint
import com.rickphobia.ricknotes.core.revisionlog.Redo
import com.rickphobia.ricknotes.logging.AppLog
import java.util.UUID
import androidx.ink.strokes.Stroke as InkStroke

// A Redo is written in black pen: it is an attempt at the question, not notes on a page.
private val REDO_PEN = InkTool.Pen(PenColour.BLACK)

// How long a finished stroke may wait in the wet layer for the pad to draw it.
private const val HANDOFF_TIMEOUT_MS = 250L

/**
 * A blank white area where the pen writes a Redo, with the same low-latency Jetpack Ink renderer as
 * a Document. Only the pen writes; fingers and palms do nothing. Strokes are in points of
 * 1 dp from the area's top-left corner and are added to [strokes] as each is finished.
 */
@Composable
internal fun RedoPad(
    strokes: SnapshotStateList<DrawnStroke>,
    modifier: Modifier = Modifier,
) {
    val renderer = remember { CanvasStrokeRenderer.create() }
    Box(modifier = modifier.clipToBounds().background(Color.White)) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawStrokes(strokes, renderer, Matrix().apply { setScale(density, density) })
        }
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context -> RedoPadView(context) { strokes.add(it) } },
        )
    }
}

/**
 * A saved [redo] on white, as written, or shrunk to fit if it was written in a bigger area than
 * this one. A stroke Jetpack Ink can't rebuild is left out (it is logged and stays saved).
 */
@Composable
internal fun SavedRedo(
    redo: Redo,
    modifier: Modifier = Modifier,
) {
    val renderer = remember { CanvasStrokeRenderer.create() }
    val drawn =
        remember(redo) {
            redo.strokes.mapNotNull { stroke ->
                stroke.toMesh()?.let { DrawnStroke(stroke, it) }
            }
        }
    val extentX = remember(redo) { redo.strokes.maxOf { s -> s.points.maxOf { it.x } + s.widthPt } }
    val extentY = remember(redo) { redo.strokes.maxOf { s -> s.points.maxOf { it.y } + s.widthPt } }
    Canvas(modifier = modifier.clipToBounds().background(Color.White)) {
        val scale = minOf(density, size.width / extentX, size.height / extentY)
        drawStrokes(drawn, renderer, Matrix().apply { setScale(scale, scale) })
    }
}

/** Draws [strokes] with [pointsToBox] mapping their points onto the canvas. */
internal fun DrawScope.drawStrokes(
    strokes: List<DrawnStroke>,
    renderer: CanvasStrokeRenderer,
    pointsToBox: Matrix,
) {
    drawIntoCanvas { canvas ->
        val native = canvas.nativeCanvas
        strokes.forEach {
            // The renderer uses the transform to pick its detail but leaves applying it to us.
            native.withMatrix(pointsToBox) { renderer.draw(native, it.mesh, pointsToBox) }
            it.drawn()
        }
    }
}

// Writing, never clicks, so there is no click to perform.
@SuppressLint("ViewConstructor", "ClickableViewAccessibility")
private class RedoPadView(
    context: Context,
    private val onFinished: (DrawnStroke) -> Unit,
) : FrameLayout(context),
    InProgressStrokesFinishedListener {
    private val inProgress = InProgressStrokesView(context)
    private val handoff = WetInkHandoff<InProgressStrokeId>(inProgress::removeFinishedStrokes)
    private val pixelsToPoints =
        Matrix().apply {
            setScale(
                1 / resources.displayMetrics.density,
                1 / resources.displayMetrics.density,
            )
        }
    private val drawing = mutableMapOf<InProgressStrokeId, Long>()

    // The pen's pointer and the stroke it is drawing, while it is down.
    private var pen: Pair<Int, InProgressStrokeId>? = null

    init {
        addView(inProgress, LayoutParams(MATCH_PARENT, MATCH_PARENT))
        inProgress.eagerInit()
        inProgress.addFinishedStrokesListener(this)
    }

    override fun onInterceptTouchEvent(event: MotionEvent): Boolean = true

    // A palm resting on the pad first is a pointer too, so the pen is followed by its own pointer ID.
    override fun onTouchEvent(event: MotionEvent): Boolean {
        val pointerId = event.getPointerId(event.actionIndex)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                val isPen = event.getToolType(event.actionIndex) == MotionEvent.TOOL_TYPE_STYLUS
                if (isPen && pen == null) pen = pointerId to start(event, pointerId)
            }

            MotionEvent.ACTION_MOVE -> {
                pen?.let { (id, stroke) -> inProgress.addToStroke(event, id, stroke) }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                pen?.takeIf { it.first == pointerId }?.let { (id, stroke) ->
                    inProgress.finishStroke(event, id, stroke)
                    pen = null
                }
            }

            MotionEvent.ACTION_CANCEL -> {
                pen?.let { (_, stroke) ->
                    drawing.remove(stroke)
                    inProgress.cancelStroke(stroke, event)
                    pen = null
                }
            }
        }
        return true
    }

    private fun start(
        event: MotionEvent,
        pointerId: Int,
    ): InProgressStrokeId {
        // Without this Android batches pen samples once per frame, which the pen tip shows as lag.
        requestUnbufferedDispatch(event)
        val brush = inkBrush(REDO_PEN.tool, REDO_PEN.colourArgb, REDO_PEN.widthPt)
        val id = inProgress.startStroke(event, pointerId, brush, pixelsToPoints)
        drawing[id] = System.currentTimeMillis()
        return id
    }

    override fun onStrokesFinished(strokes: Map<InProgressStrokeId, InkStroke>) {
        for ((id, mesh) in strokes) {
            val drawnAtMs = drawing.remove(id)
            if (drawnAtMs == null || mesh.inputs.isEmpty()) {
                AppLog.w("dropped a Redo stroke with no points")
                inProgress.removeFinishedStrokes(setOf(id))
                continue
            }
            // Posted, so it runs after the pad's draw and the wet copy is gone from the next frame.
            onFinished(DrawnStroke(mesh.toRedoStroke(drawnAtMs), mesh) { inProgress.post { handoff.drawnByPage(id) } })
            handoff.handedOff(id)
            inProgress.postDelayed({ handoff.timedOut(id) }, HANDOFF_TIMEOUT_MS)
        }
    }
}

private fun InkStroke.toRedoStroke(drawnAtMs: Long): Stroke {
    val input = StrokeInput()
    val points =
        List(inputs.size) { index ->
            inputs.populate(index, input)
            val pressure = if (input.hasPressure) input.pressure.coerceIn(0f, 1f) else 1f
            StrokePoint(input.x, input.y, pressure, input.elapsedTimeMillis)
        }
    return Stroke(
        id = StrokeId(UUID.randomUUID().toString()),
        pageId = Redo.PAGE,
        tool = REDO_PEN.tool,
        colourArgb = REDO_PEN.colourArgb,
        widthPt = REDO_PEN.widthPt,
        drawnAtMs = drawnAtMs,
        points = points,
    )
}
