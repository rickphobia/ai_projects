package com.rickphobia.ricknotes.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.touch.FingerGestures

/** One switch each for Finger erase, two-finger tap to undo and three-finger tap to redo. */
@Composable
fun FingerGesturesEditor(
    gestures: FingerGestures,
    onChange: (FingerGestures) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(text = stringResource(R.string.finger_gestures), style = MaterialTheme.typography.titleMedium)
        Text(text = stringResource(R.string.finger_gestures_help), style = MaterialTheme.typography.bodyMedium)
        GestureSwitch(stringResource(R.string.finger_erase), gestures.fingerErase) {
            onChange(gestures.copy(fingerErase = it))
        }
        Text(text = stringResource(R.string.finger_erase_help), style = MaterialTheme.typography.bodySmall)
        GestureSwitch(stringResource(R.string.two_finger_tap_undo), gestures.twoFingerTapUndo) {
            onChange(gestures.copy(twoFingerTapUndo = it))
        }
        GestureSwitch(stringResource(R.string.three_finger_tap_redo), gestures.threeFingerTapRedo) {
            onChange(gestures.copy(threeFingerTapRedo = it))
        }
    }
}

@Composable
private fun GestureSwitch(
    label: String,
    on: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(text = label, modifier = Modifier.widthIn(min = 240.dp))
        Switch(checked = on, onCheckedChange = onChange)
    }
}
