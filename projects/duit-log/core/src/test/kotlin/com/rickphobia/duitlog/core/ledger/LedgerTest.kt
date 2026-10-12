package com.rickphobia.duitlog.core.ledger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.LocalDateTime
import java.time.YearMonth

class LedgerTest {
    private val lunchTime = LocalDateTime.of(2026, 10, 12, 12, 30)

    @Test
    fun `the default Categories exist on first run, in their order`() {
        val ledger = newLedger()

        assertEquals(
            listOf(
                "Transport",
                "F&B",
                "Groceries",
                "Shopping",
                "Bills",
                "Entertainment",
                "Education",
                "Tech",
                "Health",
                "Transfers",
                "Other",
            ),
            ledger.categories(Kind.EXPENSE).map { it.name },
        )
        assertEquals(
            listOf("Salary", "Allowance", "Transfers", "Other"),
            ledger.categories(Kind.INCOME).map { it.name },
        )
    }

    @Test
    fun `each Category list holds only Categories of its kind`() {
        val ledger = newLedger()

        assertEquals(setOf(Kind.EXPENSE), ledger.categories(Kind.EXPENSE).map { it.kind }.toSet())
        assertEquals(setOf(Kind.INCOME), ledger.categories(Kind.INCOME).map { it.kind }.toSet())
    }

    @Test
    fun `an Expense added by hand keeps every field`() {
        val ledger = newLedger()

        val added =
            ledger.addByHand(
                HandEntry(
                    kind = Kind.EXPENSE,
                    amountSen = 1_250,
                    occurredAt = lunchTime,
                    merchant = "Nasi Kandar Pelita",
                    categoryId = ledger.categoryId(Kind.EXPENSE, "F&B"),
                    note = "lunch with Ali",
                ),
            )

        val shown =
            ledger
                .monthSummary(YearMonth.of(2026, 10))
                .days
                .single()
                .transactions
                .single()
        assertEquals(added, shown)
        assertEquals(Kind.EXPENSE, shown.kind)
        assertEquals(1_250L, shown.amountSen)
        assertEquals(lunchTime.atZone(KUALA_LUMPUR).toInstant(), shown.occurredAt)
        assertEquals("Nasi Kandar Pelita", shown.merchant)
        assertEquals("F&B", shown.categoryName)
        assertEquals("lunch with Ali", shown.note)
    }

    @Test
    fun `an Income added by hand takes an Income Category`() {
        val ledger = newLedger()

        val added = ledger.add(Kind.INCOME, 300_000, lunchTime, merchant = "Syarikat ABC", category = "Salary")

        assertEquals(Kind.INCOME, added.kind)
        assertEquals("Salary", added.categoryName)
    }

    @Test
    fun `the Merchant is trimmed and a blank Note is no Note`() {
        val ledger = newLedger()

        val other = ledger.categoryId(Kind.EXPENSE, "Other")

        val added = ledger.addByHand(HandEntry(Kind.EXPENSE, 500, lunchTime, "  Kedai Ali ", other, note = "   "))

        assertEquals("Kedai Ali", added.merchant)
        assertNull(added.note)
    }

    @Test
    fun `a Category from the other kind's list is refused`() {
        val ledger = newLedger()
        val salary = ledger.categoryId(Kind.INCOME, "Salary")

        assertThrows(LedgerException.CategoryKindMismatch::class.java) {
            ledger.addByHand(entry(Kind.EXPENSE, categoryId = salary))
        }
    }

    @Test
    fun `an unknown Category is refused`() {
        val ledger = newLedger()

        assertThrows(LedgerException.UnknownCategory::class.java) {
            ledger.addByHand(entry(Kind.EXPENSE, categoryId = 9_999))
        }
    }

    @Test
    fun `a zero or negative amount is refused`() {
        val ledger = newLedger()
        val other = ledger.categoryId(Kind.EXPENSE, "Other")

        assertThrows(LedgerException.AmountNotPositive::class.java) {
            ledger.addByHand(entry(Kind.EXPENSE, categoryId = other, amountSen = 0))
        }
        assertThrows(LedgerException.AmountNotPositive::class.java) {
            ledger.addByHand(entry(Kind.EXPENSE, categoryId = other, amountSen = -100))
        }
    }

    @Test
    fun `a blank Merchant is refused`() {
        val ledger = newLedger()
        val other = ledger.categoryId(Kind.EXPENSE, "Other")

        assertThrows(LedgerException.MerchantMissing::class.java) {
            ledger.addByHand(entry(Kind.EXPENSE, categoryId = other, merchant = "  "))
        }
    }

    @Test
    fun `nothing is saved when an entry is refused`() {
        val ledger = newLedger()

        runCatching { ledger.addByHand(entry(Kind.EXPENSE, categoryId = 9_999)) }

        assertEquals(emptyList<Any>(), ledger.monthSummary(YearMonth.of(2026, 10)).days)
    }

    @Test
    fun `the current Month comes from the clock in the phone's time zone`() {
        // 31 October 16:30 UTC is already 1 November 00:30 in Kuala Lumpur.
        val ledger = newLedger(now = LocalDateTime.of(2026, 11, 1, 0, 30))

        assertEquals(YearMonth.of(2026, 11), ledger.currentMonth())
    }

    @Test
    fun `a new Transaction starts at now on the phone's clock, to the minute`() {
        val ledger = newLedger(now = LocalDateTime.of(2026, 10, 12, 9, 41, 37))

        assertEquals(LocalDateTime.of(2026, 10, 12, 9, 41), ledger.now())
    }

    private fun entry(
        kind: Kind,
        categoryId: Long,
        amountSen: Long = 1_000,
        merchant: String = "Kedai Ali",
    ) = HandEntry(kind, amountSen, lunchTime, merchant, categoryId, note = null)
}
