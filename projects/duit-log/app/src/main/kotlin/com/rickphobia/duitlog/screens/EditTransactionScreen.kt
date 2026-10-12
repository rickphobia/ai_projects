package com.rickphobia.duitlog.screens

import android.database.SQLException
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import com.rickphobia.duitlog.R
import com.rickphobia.duitlog.core.ledger.Category
import com.rickphobia.duitlog.core.ledger.HandEntry
import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.LedgerException
import com.rickphobia.duitlog.core.ledger.Transaction
import com.rickphobia.duitlog.logging.AppLog
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * A Transaction's details, every one editable, with the Excluded switch and Delete. [onSave] stores
 * the edited fields and the Excluded flag together and throws a [LedgerException] when the Ledger
 * refuses them; [onDelete] runs only after the user confirms.
 */
@Composable
fun EditTransactionScreen(
    transaction: Transaction,
    zone: ZoneId,
    categories: Map<Kind, List<Category>>,
    onSave: suspend (HandEntry, excluded: Boolean) -> Unit,
    onSaved: (LocalDateTime) -> Unit,
    onDelete: suspend () -> Unit,
    onDeleted: () -> Unit,
    onCancel: () -> Unit,
) {
    var excluded by rememberSaveable { mutableStateOf(transaction.excluded) }
    var confirmingDelete by rememberSaveable { mutableStateOf(false) }
    var deleteProblem by rememberSaveable { mutableStateOf<Int?>(null) }
    val scope = rememberCoroutineScope()

    val start =
        FormStart(
            at = LocalDateTime.ofInstant(transaction.occurredAt, zone),
            kind = transaction.kind,
            amountSen = transaction.amountSen,
            merchant = transaction.merchant,
            categoryId = transaction.categoryId,
            note = transaction.note ?: "",
        )
    TransactionForm(
        categories = categories,
        start = start,
        onSave = { entry -> onSave(entry, excluded) },
        onSaved = onSaved,
        onCancel = onCancel,
    ) {
        ExcludedSwitch(excluded) { excluded = it }
        OutlinedButton(onClick = { confirmingDelete = true }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.delete), color = MaterialTheme.colorScheme.error)
        }
        deleteProblem?.let { Text(stringResource(it), color = MaterialTheme.colorScheme.error) }
    }

    if (confirmingDelete) {
        AlertDialog(
            onDismissRequest = { confirmingDelete = false },
            title = { Text(stringResource(R.string.delete_title)) },
            text = { Text(stringResource(R.string.delete_body)) },
            confirmButton = {
                TextButton(onClick = {
                    confirmingDelete = false
                    scope.launch {
                        deleteProblem = tryDelete(onDelete)
                        if (deleteProblem == null) onDeleted()
                    }
                }) { Text(stringResource(R.string.delete)) }
            },
            dismissButton = {
                TextButton(onClick = { confirmingDelete = false }) { Text(stringResource(R.string.cancel)) }
            },
        )
    }
}

@Composable
private fun ExcludedSwitch(
    excluded: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(stringResource(R.string.excluded))
            Text(
                stringResource(R.string.excluded_explainer),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = excluded, onCheckedChange = onChange)
    }
}

/** Deletes; returns the string resource to show if it failed, or null if it worked. */
private suspend fun tryDelete(onDelete: suspend () -> Unit): Int? =
    try {
        onDelete()
        null
    } catch (e: LedgerException) {
        problemText(e)
    } catch (e: SQLException) {
        AppLog.e("deleting a Transaction failed", e)
        R.string.problem_storage
    }

@Preview
@Composable
private fun EditTransactionScreenPreview() {
    val zone = ZoneId.systemDefault()
    val categories =
        mapOf(
            Kind.EXPENSE to
                listOf("Transport", "F&B", "Other").mapIndexed { i, name -> Category(i.toLong(), Kind.EXPENSE, name) },
        )
    val transaction =
        Transaction(
            7,
            Kind.EXPENSE,
            1_250,
            LocalDateTime.of(2026, 10, 2, 12, 30).atZone(zone).toInstant(),
            "Nasi Kandar",
            1,
            "F&B",
            "lunch with Ali",
            excluded = true,
        )
    DuitLogTheme {
        EditTransactionScreen(transaction, zone, categories, { _, _ -> }, {}, {}, {}, {})
    }
}
