package com.rickphobia.gloss.card

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.rickphobia.gloss.R

/**
 * The owner's Note under the Selection (and under the answer on a Define or Explain card): a text
 * box with Save and Discard, then the saved Note.
 */
@Composable
internal fun NoteView(
    state: NoteCardState,
    onTextChange: (String) -> Unit,
    onSave: () -> Unit,
    onDiscard: () -> Unit,
) {
    state.context?.let { ContextLine(it) }
    if (state.saved) {
        Text(text = state.text.trim(), style = MaterialTheme.typography.bodyLarge)
        Text(
            text = stringResource(R.string.card_note_saved),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        return
    }
    if (state.failed) {
        Text(
            text = stringResource(R.string.card_note_failed),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
        )
    }
    OutlinedTextField(
        value = state.text,
        onValueChange = onTextChange,
        modifier = Modifier.fillMaxWidth(),
        placeholder = { Text(stringResource(R.string.card_note_hint)) },
        minLines = 3,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = onSave, enabled = state.canSave) {
            Text(stringResource(R.string.card_note_save))
        }
        TextButton(onClick = onDiscard, enabled = !state.saving) { Text(stringResource(R.string.card_note_discard)) }
    }
}
