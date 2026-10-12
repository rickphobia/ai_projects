package com.rickphobia.duitlog.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.rickphobia.duitlog.R

/** The ⋮ menu: the Recorder, the notification access guide, "Share log" and the app's version. */
@Composable
fun AppMenu(
    versionName: String,
    buildNumber: Int,
    onOpenRecorder: () -> Unit,
    onOpenGuide: () -> Unit,
    onShareLog: () -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val menuLabel = stringResource(R.string.menu)
    Box {
        TextButton(onClick = { open = true }, modifier = Modifier.semantics { contentDescription = menuLabel }) {
            Text("⋮", style = MaterialTheme.typography.titleLarge)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.open_recorder)) },
                onClick = {
                    open = false
                    onOpenRecorder()
                },
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.open_guide)) },
                onClick = {
                    open = false
                    onOpenGuide()
                },
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.share_log)) },
                onClick = {
                    open = false
                    onShareLog()
                },
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.version, versionName, buildNumber)) },
                onClick = {},
                enabled = false,
            )
        }
    }
}
