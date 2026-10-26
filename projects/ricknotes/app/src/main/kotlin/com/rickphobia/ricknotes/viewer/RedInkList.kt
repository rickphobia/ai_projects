package com.rickphobia.ricknotes.viewer

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.redink.RedMark
import com.rickphobia.ricknotes.logging.AppLog

private val PICTURE_SIZE = 120.dp
private val LIST_MAX_HEIGHT = 560.dp

/**
 * "Red ink · N" in the Document toolbar while [redInk] has Red marks, hidden when the Document or
 * its Revision log is open read-only. Tapping it lists them; outside any Course folder it says why
 * they can't be logged instead.
 */
@Composable
internal fun RedInkBadge(redInk: RedInk) {
    var open by remember(redInk) { mutableStateOf(false) }
    val offered = redInk.offered
    // A list left open when the badge went away mustn't come back by itself with the next Red mark.
    LaunchedEffect(offered) { if (!offered) open = false }
    if (!offered) return
    val marks = redInk.marks
    TextButton(onClick = {
        AppLog.i("Red ink list opened with ${marks.size} Red marks")
        open = true
    }) {
        Text(
            stringResource(R.string.red_ink_badge, marks.size),
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.titleMedium,
        )
    }
    if (!open) return
    val close = { open = false }
    if (redInk.course == null) {
        AlertDialog(
            onDismissRequest = close,
            title = { Text(stringResource(R.string.red_ink)) },
            text = { Text(stringResource(R.string.red_ink_no_course_folder)) },
            confirmButton = { TextButton(onClick = close) { Text(stringResource(R.string.ok)) } },
        )
    } else {
        RedInkList(marks, redInk, onClose = close)
    }
}

/** The Red marks in page order, each with a small picture and its page number; a row jumps to it. */
@Composable
private fun RedInkList(
    marks: List<RedMark>,
    redInk: RedInk,
    onClose: () -> Unit,
) {
    val pages = redInk.shownPages()
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text(stringResource(R.string.red_ink)) },
        text = {
            LazyColumn(
                modifier = Modifier.heightIn(max = LIST_MAX_HEIGHT),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(marks, key = { it.strokeIds.first().value }) { mark ->
                    val index = pages.indexOfFirst { it.id == mark.pageId }
                    pages.getOrNull(index)?.let { page ->
                        RedMarkRow(mark, page, number = index + 1, redInk) {
                            AppLog.i("Red ink: jumping to a Red mark on page ${index + 1}")
                            redInk.jumpTo(mark)
                            onClose()
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onClose) { Text(stringResource(R.string.close)) } },
    )
}

@Composable
private fun RedMarkRow(
    mark: RedMark,
    page: DocumentPage,
    number: Int,
    redInk: RedInk,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(modifier = Modifier.size(PICTURE_SIZE), contentAlignment = Alignment.Center) {
            redMarkPicture(mark, page, redInk)?.let { Image(it, contentDescription = null) }
        }
        Text(stringResource(R.string.red_mark_page, number), style = MaterialTheme.typography.bodyLarge)
    }
}

// Drawn when the row first shows; a picture that can't be drawn leaves the row without one.
@Composable
private fun redMarkPicture(
    mark: RedMark,
    page: DocumentPage,
    redInk: RedInk,
): ImageBitmap? {
    val picture by produceState<ImageBitmap?>(null, mark, page) {
        // Read here, on the main thread: the meshes are drawn again on the render thread.
        val strokes = redInk.ink.on(mark.pageId).map { it.mesh }
        value =
            try {
                renderRedMarkPicture(redInk.pages, page, mark.box, strokes).asImageBitmap()
            } catch (e: PageRenderException) {
                AppLog.w("Red ink: the picture of a Red mark on page ${page.id.value} couldn't be drawn", e)
                null
            }
    }
    return picture
}
