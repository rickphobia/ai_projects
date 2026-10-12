package com.rickphobia.duitlog.capture

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.R
import com.rickphobia.duitlog.core.reader.Wallet
import com.rickphobia.duitlog.screens.DuitLogTheme
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

private val timeFormat = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm:ss")

/**
 * The recorder (milestone 1): the Wallet apps it accepts, then every recorded Wallet notification,
 * newest first, with "Share" and "Clear".
 */
@Composable
fun RecorderScreen(
    walletApps: List<WalletAppOnPhone>,
    recordings: List<Recording>,
    zone: ZoneId,
    onShare: () -> Unit,
    onClear: () -> Unit,
    onBack: () -> Unit,
) {
    var confirmingClear by remember { mutableStateOf(false) }
    Surface(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.safeDrawingPadding().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                TextButton(onClick = onBack) { Text(stringResource(R.string.back)) }
                Text(stringResource(R.string.recorder_title), style = MaterialTheme.typography.headlineSmall)
                Text(stringResource(R.string.recorder_explainer), style = MaterialTheme.typography.bodyMedium)
            }
            item {
                Text(stringResource(R.string.recorder_wallet_apps), style = MaterialTheme.typography.titleMedium)
                walletApps.forEach { app ->
                    val status = if (app.installed) R.string.recorder_installed else R.string.recorder_not_found
                    Text(
                        stringResource(
                            R.string.recorder_wallet_app,
                            app.wallet.label,
                            app.packageName,
                            stringResource(status),
                        ),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            item {
                Text(
                    pluralStringResource(R.plurals.recorder_count, recordings.size, recordings.size),
                    style = MaterialTheme.typography.titleMedium,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onShare, enabled = recordings.isNotEmpty()) {
                        Text(stringResource(R.string.recorder_share))
                    }
                    OutlinedButton(onClick = { confirmingClear = true }, enabled = recordings.isNotEmpty()) {
                        Text(stringResource(R.string.recorder_clear))
                    }
                }
            }
            items(recordings.asReversed()) { recording -> RecordingCard(recording, zone) }
        }
    }
    if (confirmingClear) {
        ConfirmClear(
            count = recordings.size,
            onConfirm = {
                confirmingClear = false
                onClear()
            },
            onDismiss = { confirmingClear = false },
        )
    }
}

@Composable
private fun ConfirmClear(
    count: Int,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.recorder_clear_title)) },
        text = { Text(pluralStringResource(R.plurals.recorder_clear_body, count, count)) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(stringResource(R.string.recorder_clear)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

@Composable
private fun RecordingCard(
    recording: Recording,
    zone: ZoneId,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "${recording.wallet.label} · ${timeFormat.format(ZonedDateTime.ofInstant(recording.postedAt, zone))}",
                style = MaterialTheme.typography.labelMedium,
            )
            Text(recording.title, fontWeight = FontWeight.Bold)
            Text(recording.text)
            if (recording.expandedText.isNotBlank() && recording.expandedText != recording.text) {
                Text(recording.expandedText, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Preview
@Composable
private fun RecorderScreenPreview() {
    DuitLogTheme {
        RecorderScreen(
            walletApps = listOf(WalletAppOnPhone(Wallet.TNG, "my.com.tngdigital.ewallet", installed = true)),
            recordings =
                listOf(
                    Recording(
                        Wallet.TNG,
                        "my.com.tngdigital.ewallet",
                        "key",
                        Instant.parse("2026-10-12T04:30:00Z"),
                        "Payment successful",
                        "You have paid RM12.50 to Nasi Kandar Pelita",
                        "",
                    ),
                ),
            zone = ZoneId.of("Asia/Kuala_Lumpur"),
            onShare = {},
            onClear = {},
            onBack = {},
        )
    }
}
