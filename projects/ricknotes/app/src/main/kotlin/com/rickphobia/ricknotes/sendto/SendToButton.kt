package com.rickphobia.ricknotes.sendto

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.presets.LoadedPresets
import com.rickphobia.ricknotes.core.presets.PresetsFile
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.toolbar.ToolIcon
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

private val MENU_WIDTH = 360.dp

/**
 * Send to: a menu of the Presets under each target app. The Presets file in [studyFolder] is read
 * each time the menu opens, so edits synced from the laptop show at once; a broken file's problem
 * shows at the top of the menu.
 */
@Composable
fun SendToButton(
    pdf: File,
    studyFolder: String,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var loaded by remember { mutableStateOf<LoadedPresets?>(null) }
    Box {
        ToolIcon(R.drawable.ic_send, stringResource(R.string.send_to), {
            scope.launch {
                val presets = withContext(Dispatchers.IO) { PresetsFile(File(studyFolder).toPath()).load() }
                presets.problem?.let { AppLog.w("Presets: $it") }
                loaded = presets
            }
        })
        DropdownMenu(
            expanded = loaded != null,
            onDismissRequest = { loaded = null },
            modifier = Modifier.widthIn(max = MENU_WIDTH),
        ) {
            loaded?.let { presets ->
                presets.problem?.let {
                    Text(
                        text = it,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
                SendTarget.entries.forEachIndexed { index, target ->
                    if (index > 0) HorizontalDivider()
                    Text(
                        text = stringResource(R.string.send_to_target, target.label),
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                    presets.presets.forEach { preset ->
                        val name =
                            if (preset.inkOn) {
                                stringResource(
                                    R.string.preset_ink_with_export,
                                    preset.name,
                                )
                            } else {
                                preset.name
                            }
                        DropdownMenuItem(
                            text = { Text(name) },
                            onClick = {
                                loaded = null
                                sendTo(context, pdf, target, preset)
                            },
                        )
                    }
                }
            }
        }
    }
}
