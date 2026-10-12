package com.rickphobia.duitlog.core.ledger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.YearMonth

class LedgerChangeTest {
    private val lunchTime = LocalDateTime.of(2026, 10, 12, 12, 30)
    private val october = YearMonth.of(2026, 10)
    private val unknownId = 9_999L

    @Test
    fun `a Transaction can be read back by its id`() {
        val ledger = newLedger()
        val added = ledger.add(Kind.EXPENSE, 1_250, lunchTime, category = "F&B")

        assertEquals(added, ledger.transaction(added.id))
        assertEquals(ledger.categoryId(Kind.EXPENSE, "F&B"), added.categoryId)
        assertFalse(added.excluded)
    }

    @Test
    fun `an edit changes every field and keeps the id`() {
        val ledger = newLedger()
        val added = ledger.add(Kind.EXPENSE, 1_250, lunchTime)
        val salary = ledger.categoryId(Kind.INCOME, "Salary")
        val payday = LocalDateTime.of(2026, 11, 1, 9, 0)

        val edited = ledger.edit(added.id, HandEntry(Kind.INCOME, 300_000, payday, " Syarikat ABC ", salary, "Oct pay"))

        assertEquals(added.id, edited.id)
        assertEquals(Kind.INCOME, edited.kind)
        assertEquals(300_000L, edited.amountSen)
        assertEquals(payday.atZone(KUALA_LUMPUR).toInstant(), edited.occurredAt)
        assertEquals("Syarikat ABC", edited.merchant)
        assertEquals("Salary", edited.categoryName)
        assertEquals("Oct pay", edited.note)
        assertEquals(edited, ledger.transaction(added.id))
        assertEquals(emptyList<Any>(), ledger.monthSummary(october).days)
    }

    @Test
    fun `an edit keeps the Transaction Excluded`() {
        val ledger = newLedger()
        val added = ledger.add(Kind.EXPENSE, 1_250, lunchTime)
        ledger.setExcluded(added.id, true)

        val edited = ledger.edit(added.id, entry(ledger, amountSen = 2_000))

        assertTrue(edited.excluded)
    }

    @Test
    fun `an edit is checked like a new entry and saves nothing when refused`() {
        val ledger = newLedger()
        val added = ledger.add(Kind.EXPENSE, 1_250, lunchTime)
        val salary = ledger.categoryId(Kind.INCOME, "Salary")

        assertThrows(LedgerException.AmountNotPositive::class.java) {
            ledger.edit(added.id, entry(ledger, amountSen = 0))
        }
        assertThrows(LedgerException.MerchantMissing::class.java) {
            ledger.edit(added.id, entry(ledger, merchant = " "))
        }
        assertThrows(LedgerException.CategoryKindMismatch::class.java) {
            ledger.edit(added.id, entry(ledger).copy(categoryId = salary))
        }
        assertEquals(added, ledger.transaction(added.id))
    }

    @Test
    fun `a Note can be set and cleared`() {
        val ledger = newLedger()
        val added = ledger.add(Kind.EXPENSE, 1_250, lunchTime)

        assertEquals("lunch", ledger.setNote(added.id, " lunch ").note)
        assertNull(ledger.setNote(added.id, "  ").note)
        assertNull(ledger.transaction(added.id).note)
    }

    @Test
    fun `a Transaction can be Excluded and brought back`() {
        val ledger = newLedger()
        val added = ledger.add(Kind.EXPENSE, 1_250, lunchTime)

        assertTrue(ledger.setExcluded(added.id, true).excluded)
        assertTrue(ledger.transaction(added.id).excluded)
        assertFalse(ledger.setExcluded(added.id, false).excluded)
    }

    @Test
    fun `a deleted Transaction is gone`() {
        val ledger = newLedger()
        val kept = ledger.add(Kind.EXPENSE, 500, lunchTime)
        val deleted = ledger.add(Kind.EXPENSE, 1_250, lunchTime)

        ledger.delete(deleted.id)

        assertEquals(
            listOf(kept),
            ledger
                .monthSummary(october)
                .days
                .single()
                .transactions,
        )
        assertThrows(LedgerException.UnknownTransaction::class.java) { ledger.transaction(deleted.id) }
    }

    @Test
    fun `every change to an unknown Transaction is refused`() {
        val ledger = newLedger()

        assertThrows(LedgerException.UnknownTransaction::class.java) { ledger.transaction(unknownId) }
        assertThrows(LedgerException.UnknownTransaction::class.java) { ledger.edit(unknownId, entry(ledger)) }
        assertThrows(LedgerException.UnknownTransaction::class.java) { ledger.setNote(unknownId, "x") }
        assertThrows(LedgerException.UnknownTransaction::class.java) { ledger.setExcluded(unknownId, true) }
        assertThrows(LedgerException.UnknownTransaction::class.java) { ledger.delete(unknownId) }
    }

    private fun entry(
        ledger: Ledger,
        amountSen: Long = 1_000,
        merchant: String = "Kedai Ali",
    ) = HandEntry(Kind.EXPENSE, amountSen, lunchTime, merchant, ledger.categoryId(Kind.EXPENSE, "Other"), note = null)
}
