package com.rickphobia.duitlog.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.R
import com.rickphobia.duitlog.core.ledger.CouldntRead
import com.rickphobia.duitlog.core.reader.Wallet
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private val postedFormat = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)

/**
 * Wallet notifications that mention an amount but couldn't be read, newest first, each with its
 * original text, "Add by hand" (which opens + at the notification's time) and "Dismiss".
 */
@Composable
fun CouldntReadScreen(
    entries: List<CouldntRead>,
    zone: ZoneId,
    onAddByHand: (CouldntRead) -> Unit,
    onDismiss: (CouldntRead) -> Unit,
    onBack: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.safeDrawingPadding().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                TextButton(onClick = onBack) { Text(stringResource(R.string.back)) }
                Text(stringResource(R.string.couldnt_read_title), style = MaterialTheme.typography.headlineSmall)
                Text(stringResource(R.string.couldnt_read_explainer), style = MaterialTheme.typography.bodyMedium)
            }
            if (entries.isEmpty()) {
                item { Text(stringResource(R.string.couldnt_read_empty), style = MaterialTheme.typography.bodyLarge) }
            }
            items(entries, key = { it.id }) { entry ->
                EntryCard(entry, zone, { onAddByHand(entry) }, { onDismiss(entry) })
            }
        }
    }
}

@Composable
private fun EntryCard(
    entry: CouldntRead,
    zone: ZoneId,
    onAddByHand: () -> Unit,
    onDismiss: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "${entry.wallet.label} · ${entry.postedAt.atZone(zone).format(postedFormat)}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(entry.originalText, style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onAddByHand) { Text(stringResource(R.string.couldnt_read_add)) }
                TextButton(onClick = onDismiss) { Text(stringResource(R.string.couldnt_read_dismiss)) }
            }
        }
    }
}

@Preview
@Composable
private fun CouldntReadScreenPreview() {
    val entries =
        listOf(CouldntRead(1, Wallet.TNG, Instant.parse("2026-10-12T04:30:00Z"), "Payment\nSomething new about RM8.00"))
    DuitLogTheme {
        CouldntReadScreen(entries, ZoneId.systemDefault(), {}, {}, {})
    }
}
