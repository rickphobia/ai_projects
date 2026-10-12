package com.rickphobia.duitlog.screens

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.database.SQLException
import android.text.format.DateFormat
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.R
import com.rickphobia.duitlog.core.ledger.Category
import com.rickphobia.duitlog.core.ledger.HandEntry
import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.LedgerException
import com.rickphobia.duitlog.core.ledger.Ringgit
import com.rickphobia.duitlog.logging.AppLog
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private val dateShown = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
private val timeShown = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)

/**
 * The + screen: an Expense or Income typed in by hand, starting empty at [now]. [onSave] stores
 * the entry and throws a [LedgerException] when the Ledger refuses it; [onSaved] gets the new
 * Transaction's date and time.
 */
@Composable
fun AddTransactionScreen(
    categories: Map<Kind, List<Category>>,
    now: LocalDateTime,
    onSave: suspend (HandEntry) -> Unit,
    onSaved: (LocalDateTime) -> Unit,
    onCancel: () -> Unit,
) {
    TransactionForm(categories, FormStart(now), onSave, onSaved, onCancel)
}

/** What the form shows when it opens: empty at [at], or every field of a Transaction being edited. */
data class FormStart(
    val at: LocalDateTime,
    val kind: Kind = Kind.EXPENSE,
    val amountSen: Long? = null,
    val merchant: String = "",
    val categoryId: Long? = null,
    val note: String = "",
)

/**
 * Every field of a Transaction, for adding or editing one. [extras] shows under the fields, above
 * Cancel and Save.
 */
@Composable
fun TransactionForm(
    categories: Map<Kind, List<Category>>,
    start: FormStart,
    onSave: suspend (HandEntry) -> Unit,
    onSaved: (LocalDateTime) -> Unit,
    onCancel: () -> Unit,
    extras: @Composable () -> Unit = {},
) {
    var kind by rememberSaveable { mutableStateOf(start.kind) }
    // Shown as typed, without "RM", so Ringgit.parse reads it back.
    var amount by rememberSaveable {
        mutableStateOf(
            start.amountSen?.let { Ringgit.format(it).removePrefix("RM") } ?: "",
        )
    }
    var date by rememberSaveable { mutableStateOf(start.at.toLocalDate()) }
    var time by rememberSaveable { mutableStateOf(start.at.toLocalTime()) }
    var merchant by rememberSaveable { mutableStateOf(start.merchant) }
    var categoryId by rememberSaveable { mutableStateOf(start.categoryId) }
    var note by rememberSaveable { mutableStateOf(start.note) }
    var problem by rememberSaveable { mutableStateOf<Int?>(null) }
    // Stops a double tap on Save from adding the Transaction twice.
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun save() {
        val pickedCategory = categoryId
        if (pickedCategory == null) {
            problem = R.string.problem_category
            return
        }
        val amountSen =
            try {
                Ringgit.parse(amount)
            } catch (e: LedgerException.AmountUnreadable) {
                problem = problemText(e)
                return
            }
        val entry = HandEntry(kind, amountSen, LocalDateTime.of(date, time), merchant, pickedCategory, note)
        saving = true
        scope.launch {
            problem = trySave(entry, onSave)
            saving = false
            // Last, because it closes this screen.
            if (problem == null) onSaved(entry.occurredAt)
        }
    }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .safeDrawingPadding()
                    .imePadding()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            KindPicker(kind) { picked ->
                if (kind != picked) categoryId = null
                kind = picked
            }
            AmountField(amount) { amount = it }
            DateAndTime(date, time, onDateChange = { date = it }, onTimeChange = { time = it })
            OutlinedTextField(
                value = merchant,
                onValueChange = { merchant = it },
                label = { Text(stringResource(R.string.merchant)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                modifier = Modifier.fillMaxWidth(),
            )
            CategoryPicker(categories[kind].orEmpty(), categoryId) { categoryId = it }
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text(stringResource(R.string.note)) },
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth(),
            )
            extras()
            problem?.let { Text(stringResource(it), color = MaterialTheme.colorScheme.error) }
            CancelOrSave(saving, onCancel, ::save)
        }
    }
}

@Composable
private fun CancelOrSave(
    saving: Boolean,
    onCancel: () -> Unit,
    onSave: () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        TextButton(onClick = onCancel, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.cancel)) }
        Button(
            onClick = onSave,
            enabled = !saving,
            modifier = Modifier.weight(1f),
        ) { Text(stringResource(R.string.save)) }
    }
}

@Composable
private fun AmountField(
    amount: String,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = amount,
        onValueChange = onChange,
        label = { Text(stringResource(R.string.amount)) },
        prefix = { Text("RM") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun KindPicker(
    kind: Kind,
    onPick: (Kind) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(
            selected = kind == Kind.EXPENSE,
            onClick = { onPick(Kind.EXPENSE) },
            label = { Text(stringResource(R.string.expense)) },
        )
        FilterChip(
            selected = kind == Kind.INCOME,
            onClick = { onPick(Kind.INCOME) },
            label = { Text(stringResource(R.string.income)) },
        )
    }
}

/** The Categories of the picked kind only, so an Expense can't get an Income Category. */
@Composable
private fun CategoryPicker(
    categories: List<Category>,
    pickedId: Long?,
    onPick: (Long) -> Unit,
) {
    Text(stringResource(R.string.category), style = MaterialTheme.typography.labelLarge)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        categories.forEach { category ->
            FilterChip(
                selected = pickedId == category.id,
                onClick = { onPick(category.id) },
                label = { Text(category.name) },
            )
        }
    }
}

@Composable
private fun DateAndTime(
    date: LocalDate,
    time: LocalTime,
    onDateChange: (LocalDate) -> Unit,
    onTimeChange: (LocalTime) -> Unit,
) {
    val context = LocalContext.current
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        OutlinedButton(
            onClick = {
                // The platform dialog counts months from 0.
                DatePickerDialog(
                    context,
                    { _, year, month, day -> onDateChange(LocalDate.of(year, month + 1, day)) },
                    date.year,
                    date.monthValue - 1,
                    date.dayOfMonth,
                ).show()
            },
            modifier = Modifier.weight(1f),
        ) { Text(date.format(dateShown)) }
        OutlinedButton(
            onClick = {
                TimePickerDialog(
                    context,
                    { _, hour, minute -> onTimeChange(LocalTime.of(hour, minute)) },
                    time.hour,
                    time.minute,
                    DateFormat.is24HourFormat(context),
                ).show()
            },
            modifier = Modifier.weight(1f),
        ) { Text(time.format(timeShown)) }
    }
}

/** Saves [entry]; returns the string resource to show if it wasn't saved, or null if it was. */
private suspend fun trySave(
    entry: HandEntry,
    onSave: suspend (HandEntry) -> Unit,
): Int? =
    try {
        onSave(entry)
        null
    } catch (e: LedgerException) {
        problemText(e)
    } catch (e: SQLException) {
        AppLog.e("saving a Transaction failed", e)
        R.string.problem_storage
    }

@Preview
@Composable
private fun AddTransactionScreenPreview() {
    val categories =
        mapOf(
            Kind.EXPENSE to
                listOf("Transport", "F&B", "Other").mapIndexed { i, name -> Category(i.toLong(), Kind.EXPENSE, name) },
            Kind.INCOME to listOf("Salary", "Other").mapIndexed { i, name -> Category(10L + i, Kind.INCOME, name) },
        )
    DuitLogTheme {
        AddTransactionScreen(
            categories,
            LocalDateTime.of(2026, 10, 12, 12, 30),
            onSave = {},
            onSaved = {},
            onCancel = {},
        )
    }
}
