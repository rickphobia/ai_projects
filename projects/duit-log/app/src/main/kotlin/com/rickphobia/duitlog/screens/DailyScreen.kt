package com.rickphobia.duitlog.screens

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.R
import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.Ringgit
import com.rickphobia.duitlog.core.ledger.Transaction
import com.rickphobia.duitlog.core.summary.DaySummary
import com.rickphobia.duitlog.core.summary.MonthSummary
import com.rickphobia.duitlog.core.summary.summarizeMonth
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

// How far a finger must travel sideways before it counts as a swipe to the next or previous Month.
private const val SWIPE_THRESHOLD_PX = 120f

// The part of a Transaction's row that its Category name takes; the rest is Merchant, Note and time.
private const val CATEGORY_SHARE = 0.3f

private val dayTitle = DateTimeFormatter.ofPattern("EEE d MMM")
private val timeOfDay = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)

/**
 * The Daily tab: the Month's Income, Expenses and Total, then its days, newest first. [menu] is
 * the app menu at the end of the Month bar.
 */
@Composable
fun DailyScreen(
    month: YearMonth,
    summary: MonthSummary?,
    onMonthChange: (YearMonth) -> Unit,
    onAdd: () -> Unit,
    menu: @Composable () -> Unit,
) {
    val addLabel = stringResource(R.string.add_transaction)
    Scaffold(
        topBar = {
            MonthBar(month, onMonthChange, menu)
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAdd, modifier = Modifier.semantics { contentDescription = addLabel }) {
                Text("+", style = MaterialTheme.typography.headlineSmall)
            }
        },
    ) { padding ->
        Column(
            modifier =
                Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .swipeBetweenMonths(month, onMonthChange),
        ) {
            MonthTotals(summary)
            HorizontalDivider()
            when {
                summary == null -> Unit
                summary.days.isEmpty() -> EmptyMonth()
                else -> DayList(summary.days)
            }
        }
    }
}

private fun Modifier.swipeBetweenMonths(
    month: YearMonth,
    onMonthChange: (YearMonth) -> Unit,
): Modifier =
    pointerInput(month) {
        var dragged = 0f
        detectHorizontalDragGestures(
            onDragStart = { dragged = 0f },
            onDragEnd = {
                when {
                    dragged > SWIPE_THRESHOLD_PX -> onMonthChange(month.minusMonths(1))
                    dragged < -SWIPE_THRESHOLD_PX -> onMonthChange(month.plusMonths(1))
                }
            },
        ) { _, dragAmount -> dragged += dragAmount }
    }

@Composable
private fun MonthTotals(summary: MonthSummary?) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
        LabelledAmount(R.string.income, summary?.incomeSen, Kind.INCOME, Modifier.weight(1f))
        LabelledAmount(R.string.expenses, summary?.expensesSen, Kind.EXPENSE, Modifier.weight(1f))
        LabelledAmount(R.string.total, summary?.totalSen, kind = null, Modifier.weight(1f))
    }
}

@Composable
private fun LabelledAmount(
    label: Int,
    sen: Long?,
    kind: Kind?,
    modifier: Modifier,
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(stringResource(label), style = MaterialTheme.typography.labelMedium)
        Text(
            sen?.let(Ringgit::format) ?: "",
            style = MaterialTheme.typography.titleMedium,
            color = amountColor(kind),
            maxLines = 1,
        )
    }
}

@Composable
private fun EmptyMonth() {
    Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Text(stringResource(R.string.empty_month), style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun DayList(days: List<DaySummary>) {
    LazyColumn(
        contentPadding = PaddingValues(bottom = 88.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        days.forEach { day ->
            item(key = day.date.toString()) { DayHeader(day) }
            items(day.transactions, key = { it.id }) { TransactionRow(it) }
        }
    }
}

@Composable
private fun DayHeader(day: DaySummary) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(day.date.format(dayTitle), style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
            if (day.incomeSen > 0) {
                Text(
                    Ringgit.format(day.incomeSen),
                    color = amountColor(Kind.INCOME),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            if (day.expensesSen > 0) {
                Text(
                    Ringgit.format(day.expensesSen),
                    color = amountColor(Kind.EXPENSE),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun TransactionRow(transaction: Transaction) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            transaction.categoryName ?: "",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(CATEGORY_SHARE),
        )
        Column(modifier = Modifier.weight(1f - CATEGORY_SHARE)) {
            Text(transaction.note ?: transaction.merchant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val time = transaction.occurredAt.atZone(ZoneId.systemDefault()).format(timeOfDay)
            val detail = if (transaction.note != null) "$time · ${transaction.merchant}" else time
            Text(
                detail,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(Ringgit.format(transaction.amountSen), color = amountColor(transaction.kind))
    }
}

/** Income in the theme's primary colour, Expenses in its error colour, the Total in plain text. */
@Composable
private fun amountColor(kind: Kind?) =
    when (kind) {
        Kind.INCOME -> MaterialTheme.colorScheme.primary
        Kind.EXPENSE -> MaterialTheme.colorScheme.error
        null -> MaterialTheme.colorScheme.onSurface
    }

@Preview
@Composable
private fun DailyScreenPreview() {
    val zone = ZoneId.systemDefault()
    val month = YearMonth.of(2026, 10)
    val transactions =
        listOf(
            Transaction(
                1,
                Kind.INCOME,
                300_000,
                LocalDateTime.of(2026, 10, 1, 9, 0).atZone(zone).toInstant(),
                "Syarikat ABC",
                "Salary",
                null,
            ),
            Transaction(
                2,
                Kind.EXPENSE,
                1_250,
                LocalDateTime.of(2026, 10, 2, 12, 30).atZone(zone).toInstant(),
                "Nasi Kandar",
                "F&B",
                "lunch with Ali",
            ),
        )
    DuitLogTheme {
        DailyScreen(month, summarizeMonth(month, transactions, zone), {}, {}, {})
    }
}
