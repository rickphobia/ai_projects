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
import com.rickphobia.gloss.core.context.LegadoFailure
import com.rickphobia.gloss.core.spending.MonthSpend
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Gloss's own screen: on first run it asks for the Anthropic key; after that it is Settings, with
 * Change key, the Spending limit and Share log. Both show how to switch on Legado's web service and whether Gloss can
 * reach it.
 */
@Composable
fun SettingsScreen(
    hasKey: Boolean,
    enteringKey: Boolean,
    checkingKey: Boolean,
    keyProblem: KeyProblem?,
    onSaveKey: (String) -> Unit,
    onChangeKey: () -> Unit,
    onCancelKeyEntry: () -> Unit,
    legadoStatus: LegadoStatus,
    onCheckLegado: () -> Unit,
    monthSpend: MonthSpend?,
    onSaveLimit: (String) -> Unit,
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
            SpendingSection(monthSpend, onSaveLimit)
            HorizontalDivider()
            LegadoSection(legadoStatus, onCheckLegado)
            HorizontalDivider()
            Text(stringResource(R.string.settings_where_define_is), style = MaterialTheme.typography.bodyMedium)
            HorizontalDivider()
            Text(stringResource(R.string.settings_log_explained), style = MaterialTheme.typography.bodyMedium)
            OutlinedButton(onClick = onShareLog) { Text(stringResource(R.string.share_log)) }
        }
    }
}

@Composable
private fun SpendingSection(
    monthSpend: MonthSpend?,
    onSaveLimit: (String) -> Unit,
) {
    if (monthSpend == null) return
    Text(
        stringResource(R.string.spend_this_month, dollars(monthSpend.spentMicros), dollars(monthSpend.limitMicros)),
        style = MaterialTheme.typography.bodyLarge,
    )
    var entered by remember(monthSpend.limitMicros) { mutableStateOf("") }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = entered,
            onValueChange = { entered = it },
            label = { Text(stringResource(R.string.spend_limit_label)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.weight(1f),
        )
        OutlinedButton(onClick = { onSaveLimit(entered) }, enabled = entered.isNotBlank()) {
            Text(stringResource(R.string.spend_limit_save))
        }
    }
}

private const val MICROS_DIGITS = 6
private const val CENTS_DIGITS = 2

/**
 * "$0.84" from millionths of a dollar, rounded up so a small spend never shows as $0.00, and "$10"
 * for a whole amount.
 */
private fun dollars(micros: Long): String {
    val amount = BigDecimal.valueOf(micros, MICROS_DIGITS).setScale(CENTS_DIGITS, RoundingMode.UP)
    val whole = amount.remainder(BigDecimal.ONE).signum() == 0
    return "$" + (if (whole) amount.setScale(0) else amount).toPlainString()
}

@Composable
private fun LegadoSection(
    status: LegadoStatus,
    onCheck: () -> Unit,
) {
    Text(stringResource(R.string.legado_explained), style = MaterialTheme.typography.bodyMedium)
    val (message, isProblem) =
        when (status) {
            LegadoStatus.Checking -> R.string.legado_checking to false
            LegadoStatus.Reachable -> R.string.legado_reachable to false
            is LegadoStatus.Unreachable -> legadoProblem(status.failure) to true
        }
    Text(
        stringResource(message),
        style = MaterialTheme.typography.bodyMedium,
        color = if (isProblem) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
    )
    OutlinedButton(onClick = onCheck, enabled = status != LegadoStatus.Checking) {
        Text(stringResource(R.string.legado_check_again))
    }
}

private fun legadoProblem(failure: LegadoFailure): Int =
    when (failure) {
        LegadoFailure.Off -> R.string.legado_off
        LegadoFailure.Slow -> R.string.legado_slow
        LegadoFailure.NoFileAccess, LegadoFailure.Error -> R.string.legado_error
    }

@Composable
private fun KeyEntry(
    hasKey: Boolean,
    checkingKey: Boolean,
    keyProblem: KeyProblem?,
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
                KeyProblem.Rejected -> R.string.key_rejected
                KeyProblem.NoInternet -> R.string.key_no_internet
                KeyProblem.CheckFailed -> R.string.key_check_failed
                KeyProblem.NotStored -> R.string.key_not_stored
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
