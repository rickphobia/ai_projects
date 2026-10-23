package com.rickphobia.ricknotes.viewer

import android.app.Activity
import android.content.Context
import android.widget.Toast
import androidx.activity.compose.LocalActivity
import androidx.annotation.StringRes
import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.draganddrop.toAndroidDragEvent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.core.ink.ScreenPoint
import com.rickphobia.ricknotes.core.ink.fitPicture
import com.rickphobia.ricknotes.core.ink.pageAt
import com.rickphobia.ricknotes.core.session.PictureNotPlaced
import com.rickphobia.ricknotes.imports.ImageNotReceived
import com.rickphobia.ricknotes.imports.ImageProblem
import com.rickphobia.ricknotes.imports.receiveImage
import com.rickphobia.ricknotes.ink.DocumentInk
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID
import kotlin.math.abs

// Dropped content is read into here, then copied into the Document's `.assets` and deleted.
private const val DROPS_FOLDER = "drops"

/**
 * Fills the page view and takes drops onto it: see [PictureDrop]. [placements] gives where each
 * page is, in the page view's own pixels.
 */
@Composable
internal fun PictureDropArea(
    ink: DocumentInk,
    placements: () -> List<PagePlacement>,
) {
    val activity = checkNotNull(LocalActivity.current) { "the page view is shown outside an activity" }
    val scope = rememberCoroutineScope()
    val currentPlacements by rememberUpdatedState(placements)
    var viewOffset by remember { mutableStateOf(Offset.Zero) }
    val drop =
        remember(activity, ink, scope) {
            PictureDrop(activity, ink, scope, { currentPlacements() }, { viewOffset })
        }
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .onGloballyPositioned { viewOffset = it.positionInRoot() }
                // Every drag is taken, so one that isn't an image gets a message instead of nothing.
                .dragAndDropTarget(shouldStartDragAndDrop = { true }, target = drop),
    )
}

/**
 * Takes an image dragged onto the page view, from the screenshot preview or another app in split
 * screen, and places it as a Picture where it was let go. Anything else dropped shows a message.
 * [placements] gives where each page is on the page view, and [viewOffset] where the page view is
 * in the window, since a drop's position is given in the window's terms.
 */
internal class PictureDrop(
    private val activity: Activity,
    private val ink: DocumentInk,
    private val scope: CoroutineScope,
    private val placements: () -> List<PagePlacement>,
    private val viewOffset: () -> Offset,
) : DragAndDropTarget {
    override fun onDrop(event: DragAndDropEvent): Boolean {
        val drag = event.toAndroidDragEvent()
        val uri =
            drag.clipData
                ?.takeIf { it.itemCount > 0 }
                ?.getItemAt(0)
                ?.uri
        val point = ScreenPoint(drag.x - viewOffset().x, drag.y - viewOffset().y)
        val page = pageAt(placements(), point) ?: nearestPage(placements(), point)
        val refusal =
            when {
                ink.readOnly -> R.string.picture_drop_read_only
                uri == null -> R.string.picture_drop_not_image
                page == null -> R.string.picture_drop_no_page
                else -> null
            }
        if (refusal != null || uri == null || page == null) {
            AppLog.w(
                "drop refused: read-only ${ink.readOnly}, content ${uri != null}, page ${page != null}, " +
                    "types ${drag.clipDescription?.mimeTypesText()}",
            )
            refusal?.let { tell(activity, it) }
            return false
        }
        // Lets this app read content from another app; it ends when released or the activity goes.
        val permissions = activity.requestDragAndDropPermissions(drag)
        scope.launch {
            val target = File(File(activity.cacheDir, DROPS_FOLDER), UUID.randomUUID().toString())
            try {
                val image = withContext(Dispatchers.IO) { receiveImage(activity.contentResolver, uri, target) }
                val frame = fitPicture(image.widthPx, image.heightPx, page.toPage(point), page.widthPt, page.heightPt)
                val picture = ink.place(image.file, image.extension, page.pageId, frame)
                AppLog.i("placed Picture ${picture.id.value} on ${page.pageId.value}")
            } catch (e: ImageNotReceived) {
                AppLog.w("drop not placed: ${e.message}", e)
                tell(activity, e.problem.message)
            } catch (e: PictureNotPlaced) {
                AppLog.e("drop not placed", e)
                tell(activity, R.string.picture_drop_not_saved)
            } finally {
                permissions?.release()
                // Not on the IO dispatcher: this also runs when the Document closes mid-drop, and
                // deleting one small file is quick.
                target.delete()
            }
        }
        return true
    }
}

// A drop in the gap between two pages goes on the nearer one.
private fun nearestPage(
    placements: List<PagePlacement>,
    point: ScreenPoint,
): PagePlacement? =
    placements.minByOrNull { page ->
        val top = page.top
        val bottom = page.top + page.heightPt * page.pixelsPerPoint
        if (point.y < top) abs(top - point.y) else abs(point.y - bottom)
    }

private fun android.content.ClipDescription.mimeTypesText(): String =
    (0 until mimeTypeCount).joinToString { getMimeType(it) }

@get:StringRes
private val ImageProblem.message: Int
    get() =
        when (this) {
            ImageProblem.UNREADABLE -> R.string.picture_drop_unreadable
            ImageProblem.NOT_AN_IMAGE -> R.string.picture_drop_not_image
            ImageProblem.TOO_BIG -> R.string.picture_drop_too_big
        }

private fun tell(
    context: Context,
    @StringRes message: Int,
) {
    Toast.makeText(context, message, Toast.LENGTH_LONG).show()
}
