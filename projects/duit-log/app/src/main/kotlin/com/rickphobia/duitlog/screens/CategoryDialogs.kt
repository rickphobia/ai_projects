package com.rickphobia.duitlog.screens

import android.database.SQLException
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.R
import com.rickphobia.duitlog.core.ledger.Category
import com.rickphobia.duitlog.core.ledger.LedgerException
import com.rickphobia.duitlog.core.ledger.OTHER
import com.rickphobia.duitlog.logging.AppLog
import kotlinx.coroutines.launch

/** Asks for a Category name; stays open showing the problem when [onSave] is refused. */
@Composable
internal fun CategoryNameDialog(
    start: String,
    @StringRes title: Int,
    onSave: suspend (String) -> Unit,
    onClose: () -> Unit,
) {
    var name by remember { mutableStateOf(start) }
    var problem by remember { mutableStateOf<Int?>(null) }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onClose,
        title = { Text(stringResource(title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(stringResource(R.string.category_name)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                    modifier = Modifier.fillMaxWidth(),
                )
                problem?.let { Text(stringResource(it), color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(enabled = !saving, onClick = {
                saving = true
                scope.launch {
                    problem = tryCategoryChange("saving a Category name") { onSave(name) }
                    saving = false
                    if (problem == null) onClose()
                }
            }) { Text(stringResource(R.string.save)) }
        },
        dismissButton = { TextButton(onClick = onClose) { Text(stringResource(R.string.cancel)) } },
    )
}

/**
 * Confirms deleting [category]. When it has Transactions, asks which of [moveTargets] they move
 * to, starting at Other.
 */
@Composable
internal fun DeleteCategoryDialog(
    category: Category,
    moveTargets: List<Category>,
    actions: CategoryActions,
    onClose: () -> Unit,
) {
    val count by produceState<Long?>(null, category.id) {
        value =
            try {
                actions.transactionCount(category.id)
            } catch (e: SQLException) {
                AppLog.e("counting Category ${category.id}'s Transactions failed", e)
                null
            }
    }
    var moveTo by remember { mutableStateOf(moveTargets.firstOrNull { it.name == OTHER }?.id) }
    var problem by remember { mutableStateOf<Int?>(null) }
    var deleting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onClose,
        title = { Text(stringResource(R.string.delete_category_title, category.name)) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                val transactions = count ?: 0L
                if (transactions == 0L) {
                    Text(stringResource(R.string.delete_category_empty))
                } else {
                    Text(
                        pluralStringResource(
                            R.plurals.delete_category_move,
                            transactions.toInt(),
                            transactions.toInt(),
                        ),
                    )
                    moveTargets.forEach { target ->
                        MoveTarget(target, selected = target.id == moveTo) { moveTo = target.id }
                    }
                }
                problem?.let { Text(stringResource(it), color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            val target = moveTo
            TextButton(enabled = !deleting && count != null && target != null, onClick = {
                if (target != null) {
                    deleting = true
                    scope.launch {
                        problem =
                            tryCategoryChange(
                                "deleting Category ${category.id}",
                            ) { actions.delete(category.id, target) }
                        deleting = false
                        if (problem == null) onClose()
                    }
                }
            }) { Text(stringResource(R.string.delete), color = MaterialTheme.colorScheme.error) }
        },
        dismissButton = { TextButton(onClick = onClose) { Text(stringResource(R.string.cancel)) } },
    )
}

@Composable
private fun MoveTarget(
    target: Category,
    selected: Boolean,
    onSelect: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().selectable(selected = selected, onClick = onSelect),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = null)
        Text(target.name)
    }
}

/** Runs [change]; returns the string resource to show if it failed, or null if it worked. */
private suspend fun tryCategoryChange(
    doing: String,
    change: suspend () -> Unit,
): Int? =
    try {
        change()
        null
    } catch (e: LedgerException) {
        AppLog.i("$doing refused: ${e.javaClass.simpleName}")
        problemText(e)
    } catch (e: SQLException) {
        AppLog.e("$doing failed", e)
        R.string.problem_storage
    }
