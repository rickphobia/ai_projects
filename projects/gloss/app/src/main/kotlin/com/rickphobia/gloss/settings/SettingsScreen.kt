package com.rickphobia.gloss.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.rickphobia.gloss.R
import com.rickphobia.gloss.core.ai.AiFailure

/**
 * Gloss's own screen: on first run it asks for the Anthropic key; after that it is Settings, with
 * Change key and Share log.
 */
@Composable
fun SettingsScreen(
    hasKey: Boolean,
    enteringKey: Boolean,
    checkingKey: Boolean,
    keyProblem: AiFailure?,
    onSaveKey: (String) -> Unit,
    onChangeKey: () -> Unit,
    onCancelKeyEntry: () -> Unit,
    onShareLog: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .safeDrawingPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineMedium)
            if (enteringKey) {
                KeyEntry(hasKey, checkingKey, keyProblem, onSaveKey, onCancelKeyEntry)
            } else {
                Text(stringResource(R.string.settings_key_saved), style = MaterialTheme.typography.bodyLarge)
                OutlinedButton(onClick = onChangeKey) { Text(stringResource(R.string.change_key)) }
            }
            HorizontalDivider()
            Text(stringResource(R.string.settings_where_define_is), style = MaterialTheme.typography.bodyMedium)
            HorizontalDivider()
            Text(stringResource(R.string.settings_log_explained), style = MaterialTheme.typography.bodyMedium)
            OutlinedButton(onClick = onShareLog) { Text(stringResource(R.string.share_log)) }
        }
    }
}

@Composable
private fun KeyEntry(
    hasKey: Boolean,
    checkingKey: Boolean,
    keyProblem: AiFailure?,
    onSaveKey: (String) -> Unit,
    onCancel: () -> Unit,
) {
    // Not rememberSaveable: the key would be written into the saved state.
    var entered by remember { mutableStateOf("") }
    Text(stringResource(R.string.key_explained), style = MaterialTheme.typography.bodyMedium)
    OutlinedTextField(
        value = entered,
        onValueChange = { entered = it },
        label = { Text(stringResource(R.string.key_label)) },
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
        modifier = Modifier.fillMaxWidth(),
    )
    if (keyProblem != null) {
        val message =
            when (keyProblem) {
                AiFailure.KeyRejected -> R.string.key_rejected
                AiFailure.NoInternet -> R.string.key_no_internet
                AiFailure.NoKey, AiFailure.AiError -> R.string.key_check_failed
            }
        Text(
            stringResource(message),
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = { onSaveKey(entered) }, enabled = entered.isNotBlank() && !checkingKey) {
            Text(stringResource(if (checkingKey) R.string.key_checking else R.string.key_save))
        }
        if (hasKey) {
            OutlinedButton(onClick = onCancel) { Text(stringResource(R.string.cancel)) }
        }
    }
}
