package com.rickphobia.duitlog.core.summary

import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.Transaction
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

/**
 * What the Daily tab shows for one Month: its totals and its days, newest first. [zone] is the
 * time zone the days were cut in, for showing each Transaction's time of day.
 */
data class MonthSummary(
    val month: YearMonth,
    val zone: ZoneId,
    val incomeSen: Long,
    val expensesSen: Long,
    val days: List<DaySummary>,
) {
    val totalSen: Long get() = incomeSen - expensesSen
}

/** One day's Transactions, newest first, and its subtotals. */
data class DaySummary(
    val date: LocalDate,
    val incomeSen: Long,
    val expensesSen: Long,
    val transactions: List<Transaction>,
) {
    val totalSen: Long get() = incomeSen - expensesSen
}

/** Groups [transactions] (all inside [month]) by their day in [zone]. */
fun summarizeMonth(
    month: YearMonth,
    transactions: List<Transaction>,
    zone: ZoneId,
): MonthSummary {
    val newestFirst =
        transactions.sortedWith(
            compareByDescending<Transaction> { it.occurredAt }.thenByDescending { it.id },
        )
    val days =
        newestFirst
            .groupBy { it.occurredAt.atZone(zone).toLocalDate() }
            .map { (date, ofDay) -> DaySummary(date, ofDay.sumOf(Kind.INCOME), ofDay.sumOf(Kind.EXPENSE), ofDay) }
            .sortedByDescending { it.date }
    return MonthSummary(month, zone, transactions.sumOf(Kind.INCOME), transactions.sumOf(Kind.EXPENSE), days)
}

private fun List<Transaction>.sumOf(kind: Kind): Long = filter { it.kind == kind }.sumOf { it.amountSen }
