package com.rickphobia.ricknotes.revisionlog

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.RevisionLogSession
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.snip.SNIP_MAX_EXTRA_ZOOM
import com.rickphobia.ricknotes.snip.SnipFocus
import com.rickphobia.ricknotes.snip.coveringCenter
import com.rickphobia.ricknotes.snip.shiftToMiddle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.nio.file.Path

/** [entry]'s two Snips side by side: without ink (front) and with it (back). */
@Composable
internal fun SnipPair(
    session: RevisionLogSession,
    entry: Entry,
    modifier: Modifier = Modifier,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = modifier.fillMaxWidth()) {
        val focus = entry.snipFocus()
        Snip(session.frontSnip(entry), R.string.snip_without_ink, Modifier.weight(1f), focus)
        Snip(session.backSnip(entry), R.string.snip_with_ink, Modifier.weight(1f), focus)
    }
}

/** Where this Entry's Snips open zoomed to: its Red mark's box, or null to show them whole. */
internal fun Entry.snipFocus(): SnipFocus? = SnipFocus.of(source.area, box)

/**
 * The Snip in [file] with its [label], on white, or a note when it can't be read. With a [focus] it
 * opens zoomed to it, and pinching zooms out to the whole Snip and back in.
 */
@Composable
internal fun Snip(
    file: Path,
    label: Int,
    modifier: Modifier,
    focus: SnipFocus? = null,
) {
    val image by produceState<ImageBitmap?>(null, file) {
        value = withContext(Dispatchers.IO) { BitmapFactory.decodeFile(file.toString())?.asImageBitmap() }
        if (value == null) AppLog.w("Snip ${file.fileName} can't be read")
    }
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(stringResource(label), style = MaterialTheme.typography.labelMedium)
        val bitmap = image
        if (bitmap == null) {
            Text(stringResource(R.string.snip_missing), style = MaterialTheme.typography.bodySmall)
        } else {
            // Pages are white in dark mode too, so the Snip sits on white.
            val picture = Modifier.fillMaxWidth().background(Color.White)
            Image(
                bitmap,
                contentDescription = stringResource(label),
                contentScale = ContentScale.Fit,
                modifier = if (focus == null) picture else picture.zoomedTo(focus),
            )
        }
    }
}

/** Opens zoomed to [focus]; pinching zooms between the whole picture and past [focus], and drags pan. */
private fun Modifier.zoomedTo(focus: SnipFocus): Modifier =
    composed {
        val opening = focus.fitScale()
        var scale by remember(focus) { mutableFloatStateOf(opening) }
        // The point of the picture (as fractions of it) shown in the middle of the frame.
        var centerX by remember(focus) { mutableFloatStateOf(focus.centerX) }
        var centerY by remember(focus) { mutableFloatStateOf(focus.centerY) }
        clipToBounds()
            .pointerInput(focus) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(1f, opening * SNIP_MAX_EXTRA_ZOOM)
                    centerX = coveringCenter(centerX - pan.x / (size.width * scale), scale)
                    centerY = coveringCenter(centerY - pan.y / (size.height * scale), scale)
                }
            }.graphicsLayer {
                scaleX = scale
                scaleY = scale
                translationX = shiftToMiddle(coveringCenter(centerX, scale), scale) * size.width
                translationY = shiftToMiddle(coveringCenter(centerY, scale), scale) * size.height
            }
    }

/** Asks before deleting an Entry: the log is a record, so a delete is never a slip. */
@Composable
internal fun DeleteEntryDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.delete_entry_title)) },
        text = { Text(stringResource(R.string.delete_entry_text)) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(stringResource(R.string.delete_entry)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}
