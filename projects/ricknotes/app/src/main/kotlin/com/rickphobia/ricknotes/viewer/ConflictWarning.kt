package com.rickphobia.ricknotes.viewer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.session.ConflictNotResolved
import com.rickphobia.ricknotes.ink.DocumentInk
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.launch

/**
 * The warning a Document shows while the sync app's Conflict copy of its Ink file waits for a
 * choice; the pen draws nothing until then. Whichever side isn't kept goes into Versions.
 */
@Composable
internal fun ConflictWarning(ink: DocumentInk) {
    val copy = ink.conflictCopy ?: return
    val scope = rememberCoroutineScope()
    var busy by remember(copy) { mutableStateOf(false) }
    var failure by remember(copy) { mutableStateOf<String?>(null) }

    fun choose(keep: suspend DocumentInk.() -> Unit) {
        busy = true
        scope.launch {
            try {
                ink.keep()
                failure = null
            } catch (e: ConflictNotResolved) {
                AppLog.e("Conflict copy $copy not resolved", e)
                failure = e.message
            } finally {
                busy = false
            }
        }
    }

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(
            text = stringResource(R.string.ink_conflict_copy, copy),
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
        failure?.let {
            Text(text = it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
            Button(onClick = { choose { keepMine() } }, enabled = !busy) {
                Text(stringResource(R.string.keep_mine))
            }
            OutlinedButton(onClick = { choose { keepTheOther() } }, enabled = !busy) {
                Text(stringResource(R.string.keep_the_other))
            }
        }
    }
}
