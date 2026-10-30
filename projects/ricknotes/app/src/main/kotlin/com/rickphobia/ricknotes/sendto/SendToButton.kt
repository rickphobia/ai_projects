package com.rickphobia.ricknotes.sendto

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.presets.LoadedPresets
import com.rickphobia.ricknotes.core.presets.Preset
import com.rickphobia.ricknotes.core.presets.PresetsFile
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.toolbar.ToolIcon
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

private val MENU_WIDTH = 360.dp

/** What the open menu offers: the Presets, and the other Pane's PDF when Both Panes can go. */
private class SendToMenu(
    val presets: LoadedPresets,
    val otherPane: File?,
)

/**
 * Send to: a menu of the Presets under each target app. The Presets file in [studyFolder] is read
 * each time the menu opens, so edits synced from the laptop show at once; a broken file's problem
 * shows at the top of the menu. When [otherPane] gives the other Pane's PDF as the menu opens, a
 * This Document / Both Panes choice comes first, on This Document each time.
 */
@Composable
fun SendToButton(
    pdf: File,
    otherPane: () -> File?,
    studyFolder: String,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var menu by remember { mutableStateOf<SendToMenu?>(null) }
    var bothPanes by remember { mutableStateOf(false) }
    Box {
        ToolIcon(R.drawable.ic_send, stringResource(R.string.send_to), {
            val other = otherPane()
            bothPanes = false
            scope.launch {
                val presets = withContext(Dispatchers.IO) { PresetsFile(File(studyFolder).toPath()).load() }
                presets.problem?.let { AppLog.w("Presets: $it") }
                menu = SendToMenu(presets, other)
            }
        })
        DropdownMenu(
            expanded = menu != null,
            onDismissRequest = { menu = null },
            modifier = Modifier.widthIn(max = MENU_WIDTH),
        ) {
            menu?.let { open ->
                open.presets.problem?.let {
                    Text(
                        text = it,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
                open.otherPane?.let { other ->
                    BothPanesChoice(pdf, other, bothPanes) { bothPanes = it }
                    HorizontalDivider()
                }
                val pdfs = listOfNotNull(pdf, open.otherPane?.takeIf { bothPanes })
                PresetsByTarget(open.presets) { target, preset ->
                    menu = null
                    sendTo(context, pdfs, target, preset)
                }
            }
        }
    }
}

/** This Document, or Both Panes naming [pdf] and [other] without `.pdf`. */
@Composable
private fun BothPanesChoice(
    pdf: File,
    other: File,
    bothPanes: Boolean,
    choose: (Boolean) -> Unit,
) {
    Column(modifier = Modifier.selectableGroup()) {
        ChoiceRow(stringResource(R.string.send_this_document), selected = !bothPanes) { choose(false) }
        ChoiceRow(
            stringResource(R.string.send_both_panes, pdf.nameWithoutExtension, other.nameWithoutExtension),
            selected = bothPanes,
        ) { choose(true) }
    }
}

@Composable
private fun ChoiceRow(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
                .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // The row takes the tap, so the button itself needs none.
        RadioButton(selected = selected, onClick = null)
        Text(label, modifier = Modifier.padding(start = 8.dp))
    }
}

/** Each target app's heading over every Preset; picking one sends with it. */
@Composable
private fun PresetsByTarget(
    loaded: LoadedPresets,
    send: (SendTarget, Preset) -> Unit,
) {
    SendTarget.entries.forEachIndexed { index, target ->
        if (index > 0) HorizontalDivider()
        Text(
            text = stringResource(R.string.send_to_target, target.label),
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        )
        loaded.presets.forEach { preset ->
            val name =
                if (preset.inkOn) {
                    stringResource(R.string.preset_ink_with_export, preset.name)
                } else {
                    preset.name
                }
            DropdownMenuItem(text = { Text(name) }, onClick = { send(target, preset) })
        }
    }
}
