package com.rickphobia.duitlog.core.summary

import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.add
import com.rickphobia.duitlog.core.ledger.newLedger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.YearMonth

class ExcludedTest {
    private val october = YearMonth.of(2026, 10)

    @Test
    fun `Excluded Transactions stay in the list but count in no total`() {
        val ledger = newLedger()
        ledger.add(Kind.INCOME, 300_000, LocalDateTime.of(2026, 10, 1, 9, 0), category = "Salary")
        val fromParents = ledger.add(Kind.INCOME, 50_000, LocalDateTime.of(2026, 10, 1, 10, 0))
        ledger.add(Kind.EXPENSE, 1_250, LocalDateTime.of(2026, 10, 1, 12, 30))
        val wrong = ledger.add(Kind.EXPENSE, 8_000, LocalDateTime.of(2026, 10, 1, 19, 0))
        ledger.setExcluded(fromParents.id, true)
        ledger.setExcluded(wrong.id, true)

        val summary = ledger.monthSummary(october)
        val day = summary.days.single()

        assertEquals(300_000L, summary.incomeSen)
        assertEquals(1_250L, summary.expensesSen)
        assertEquals(298_750L, summary.totalSen)
        assertEquals(300_000L, day.incomeSen)
        assertEquals(1_250L, day.expensesSen)
        assertEquals(4, day.transactions.size)
        assertTrue(day.transactions.single { it.id == wrong.id }.excluded)
    }

    @Test
    fun `a day with only Excluded Transactions has zero subtotals`() {
        val ledger = newLedger()
        val added = ledger.add(Kind.EXPENSE, 1_250, LocalDateTime.of(2026, 10, 3, 12, 0))
        ledger.setExcluded(added.id, true)

        val day = ledger.monthSummary(october).days.single()

        assertEquals(0L, day.incomeSen)
        assertEquals(0L, day.expensesSen)
    }
}
