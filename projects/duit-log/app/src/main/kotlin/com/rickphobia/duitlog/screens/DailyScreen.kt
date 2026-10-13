package com.rickphobia.duitlog.screens

import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
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

// How visible an Excluded Transaction's row is, against 1 for the rest.
private const val EXCLUDED_ALPHA = 0.45f

private val dayTitle = DateTimeFormatter.ofPattern("EEE d MMM")
private val timeOfDay = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)

/** What the Daily tab knows about the Month it shows. */
sealed interface MonthState {
    data object Loading : MonthState

    data class Shown(
        val summary: MonthSummary,
    ) : MonthState

    /** The database couldn't be read; the log has why. */
    data object Unreadable : MonthState
}

/**
 * The Daily tab: the Month's Income, Expenses and Total, then its days, newest first. [menu] is
 * the app menu at the end of the Month bar; [banner] shows above the totals when something needs
 * fixing, such as notification access being off.
 */
@Composable
fun DailyScreen(
    month: YearMonth,
    state: MonthState,
    onMonthChange: (YearMonth) -> Unit,
    onAdd: () -> Unit,
    onOpen: (Transaction) -> Unit,
    menu: @Composable () -> Unit,
    banner: @Composable () -> Unit = {},
) {
    val addLabel = stringResource(R.string.add_transaction)
    // The swipe handler lives across recompositions, so it must call the newest callback.
    val currentOnMonthChange by rememberUpdatedState(onMonthChange)
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
                    .swipeBetweenMonths(month) { currentOnMonthChange(it) },
        ) {
            banner()
            MonthTotals((state as? MonthState.Shown)?.summary)
            HorizontalDivider()
            when {
                state is MonthState.Unreadable -> Message(R.string.month_unreadable)
                state !is MonthState.Shown -> Unit
                state.summary.days.isEmpty() -> Message(R.string.empty_month)
                else -> DayList(state.summary, onOpen)
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
    @StringRes label: Int,
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
private fun Message(
    @StringRes text: Int,
) {
    Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Text(stringResource(text), style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun DayList(
    summary: MonthSummary,
    onOpen: (Transaction) -> Unit,
) {
    LazyColumn(
        contentPadding = PaddingValues(bottom = 88.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        summary.days.forEach { day ->
            item(key = day.date.toString()) { DayHeader(day) }
            items(day.transactions, key = { it.id }) { TransactionRow(it, summary.zone, onOpen) }
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
private fun TransactionRow(
    transaction: Transaction,
    zone: ZoneId,
    onOpen: (Transaction) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onOpen(transaction) }
                // Greyed, so it reads as counting in no total.
                .alpha(if (transaction.excluded) EXCLUDED_ALPHA else 1f)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // A captured Transaction waits for a Category; it stands out until it gets one.
        val uncategorised = transaction.categoryName == null
        Text(
            transaction.categoryName ?: stringResource(R.string.uncategorised),
            style = MaterialTheme.typography.bodySmall,
            color = with(MaterialTheme.colorScheme) { if (uncategorised) tertiary else onSurfaceVariant },
            fontWeight = if (uncategorised) FontWeight.Bold else null,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(CATEGORY_SHARE),
        )
        Column(modifier = Modifier.weight(1f - CATEGORY_SHARE)) {
            Text(transaction.note ?: transaction.merchant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val time = transaction.occurredAt.atZone(zone).format(timeOfDay)
            val withMerchant = if (transaction.note != null) "$time · ${transaction.merchant}" else time
            val detail =
                if (transaction.excluded) {
                    "$withMerchant · ${stringResource(
                        R.string.excluded,
                    )}"
                } else {
                    withMerchant
                }
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
                1,
                "Salary",
                null,
            ),
            Transaction(
                2,
                Kind.EXPENSE,
                1_250,
                LocalDateTime.of(2026, 10, 2, 12, 30).atZone(zone).toInstant(),
                "Nasi Kandar",
                2,
                "F&B",
                "lunch with Ali",
                excluded = true,
            ),
            Transaction(
                3,
                Kind.EXPENSE,
                850,
                LocalDateTime.of(2026, 10, 2, 18, 5).atZone(zone).toInstant(),
                "Kedai Runcit",
                null,
                null,
                null,
            ),
        )
    DuitLogTheme {
        DailyScreen(month, MonthState.Shown(summarizeMonth(month, transactions, zone)), {}, {}, {}, {})
    }
}
