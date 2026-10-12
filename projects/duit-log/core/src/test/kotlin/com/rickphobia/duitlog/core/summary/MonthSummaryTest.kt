package com.rickphobia.duitlog.core.summary

import com.rickphobia.duitlog.core.ledger.KUALA_LUMPUR
import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.add
import com.rickphobia.duitlog.core.ledger.newLedger
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.ZoneId

class MonthSummaryTest {
    private val october = YearMonth.of(2026, 10)
    private val november = YearMonth.of(2026, 11)

    @Test
    fun `an empty Month has nothing in it`() {
        val summary = newLedger().monthSummary(october)

        assertEquals(october, summary.month)
        assertEquals(0L, summary.incomeSen)
        assertEquals(0L, summary.expensesSen)
        assertEquals(0L, summary.totalSen)
        assertEquals(emptyList<DaySummary>(), summary.days)
    }

    @Test
    fun `the Month's Income, Expenses and Total add up its Transactions`() {
        val ledger = newLedger()
        ledger.add(Kind.INCOME, 300_000, LocalDateTime.of(2026, 10, 1, 9, 0), category = "Salary")
        ledger.add(Kind.EXPENSE, 1_250, LocalDateTime.of(2026, 10, 2, 12, 30))
        ledger.add(Kind.EXPENSE, 8_000, LocalDateTime.of(2026, 10, 2, 19, 0))

        val summary = ledger.monthSummary(october)

        assertEquals(300_000L, summary.incomeSen)
        assertEquals(9_250L, summary.expensesSen)
        assertEquals(290_750L, summary.totalSen)
    }

    @Test
    fun `the Total goes below zero when Expenses are larger`() {
        val ledger = newLedger()
        ledger.add(Kind.INCOME, 1_000, LocalDateTime.of(2026, 10, 1, 9, 0), category = "Allowance")
        ledger.add(Kind.EXPENSE, 4_000, LocalDateTime.of(2026, 10, 1, 10, 0))

        assertEquals(-3_000L, ledger.monthSummary(october).totalSen)
    }

    @Test
    fun `Transactions are grouped by day, newest day and newest Transaction first, with subtotals`() {
        val ledger = newLedger()
        val breakfast = ledger.add(Kind.EXPENSE, 600, LocalDateTime.of(2026, 10, 2, 8, 0))
        val dinner = ledger.add(Kind.EXPENSE, 2_400, LocalDateTime.of(2026, 10, 2, 20, 0))
        val salary = ledger.add(Kind.INCOME, 300_000, LocalDateTime.of(2026, 10, 2, 9, 0), category = "Salary")
        val bus = ledger.add(Kind.EXPENSE, 250, LocalDateTime.of(2026, 10, 1, 7, 45))
        val lunch = ledger.add(Kind.EXPENSE, 1_100, LocalDateTime.of(2026, 10, 5, 13, 0))

        val days = ledger.monthSummary(october).days

        assertEquals(
            listOf(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 1)),
            days.map { it.date },
        )
        assertEquals(
            listOf(listOf(lunch), listOf(dinner, salary, breakfast), listOf(bus)),
            days.map { it.transactions },
        )
        assertEquals(listOf(1_100L, 3_000L, 250L), days.map { it.expensesSen })
        assertEquals(listOf(0L, 300_000L, 0L), days.map { it.incomeSen })
        assertEquals(listOf(-1_100L, 297_000L, -250L), days.map { it.totalSen })
    }

    @Test
    fun `23_59 on the last day of a Month belongs to that Month`() {
        val ledger = newLedger()
        val lastMinute = ledger.add(Kind.EXPENSE, 700, LocalDateTime.of(2026, 10, 31, 23, 59))

        val octoberDays = ledger.monthSummary(october).days
        assertEquals(LocalDate.of(2026, 10, 31), octoberDays.single().date)
        assertEquals(listOf(lastMinute), octoberDays.single().transactions)
        assertEquals(emptyList<DaySummary>(), ledger.monthSummary(november).days)
    }

    @Test
    fun `00_00 on the first day of a Month belongs to that Month, not the one before`() {
        val ledger = newLedger()
        val midnight = ledger.add(Kind.EXPENSE, 700, LocalDateTime.of(2026, 11, 1, 0, 0))

        assertEquals(emptyList<DaySummary>(), ledger.monthSummary(october).days)
        val novemberDays = ledger.monthSummary(november).days
        assertEquals(LocalDate.of(2026, 11, 1), novemberDays.single().date)
        assertEquals(listOf(midnight), novemberDays.single().transactions)
        assertEquals(700L, ledger.monthSummary(november).expensesSen)
    }

    @Test
    fun `Months and days follow the phone's time zone`() {
        // 1 November 00:30 in Kuala Lumpur is still 31 October 16:30 in UTC.
        val inKualaLumpur = newLedger()
        inKualaLumpur.add(Kind.EXPENSE, 700, LocalDateTime.of(2026, 11, 1, 0, 30))
        assertEquals(
            LocalDate.of(2026, 11, 1),
            inKualaLumpur
                .monthSummary(november)
                .days
                .single()
                .date,
        )

        assertEquals(KUALA_LUMPUR, inKualaLumpur.monthSummary(november).zone)

        val inUtc = newLedger(zone = ZoneId.of("UTC"))
        inUtc.add(Kind.EXPENSE, 700, LocalDateTime.of(2026, 10, 31, 16, 30))
        assertEquals(
            LocalDate.of(2026, 10, 31),
            inUtc
                .monthSummary(october)
                .days
                .single()
                .date,
        )
        assertEquals(emptyList<DaySummary>(), inUtc.monthSummary(november).days)
    }

    @Test
    fun `three Transactions across two days and two Months land where they should`() {
        val ledger = newLedger()
        ledger.add(Kind.EXPENSE, 1_000, LocalDateTime.of(2026, 10, 30, 12, 0))
        ledger.add(Kind.INCOME, 5_000, LocalDateTime.of(2026, 10, 31, 18, 0), category = "Transfers")
        ledger.add(Kind.EXPENSE, 2_000, LocalDateTime.of(2026, 11, 1, 8, 0))

        val octoberSummary = ledger.monthSummary(october)
        assertEquals(listOf(31, 30), octoberSummary.days.map { it.date.dayOfMonth })
        assertEquals(
            Triple(5_000L, 1_000L, 4_000L),
            Triple(octoberSummary.incomeSen, octoberSummary.expensesSen, octoberSummary.totalSen),
        )

        val novemberSummary = ledger.monthSummary(november)
        assertEquals(listOf(1), novemberSummary.days.map { it.date.dayOfMonth })
        assertEquals(-2_000L, novemberSummary.totalSen)
    }
}
