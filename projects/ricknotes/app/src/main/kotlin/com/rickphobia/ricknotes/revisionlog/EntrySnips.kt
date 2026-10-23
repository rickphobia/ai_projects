package com.rickphobia.ricknotes.revisionlog

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.RevisionLogSession
import com.rickphobia.ricknotes.logging.AppLog
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
        Snip(session.frontSnip(entry), R.string.snip_without_ink, Modifier.weight(1f))
        Snip(session.backSnip(entry), R.string.snip_with_ink, Modifier.weight(1f))
    }
}

@Composable
private fun Snip(
    file: Path,
    label: Int,
    modifier: Modifier,
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
            Image(
                bitmap,
                contentDescription = stringResource(label),
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth().background(Color.White),
            )
        }
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
