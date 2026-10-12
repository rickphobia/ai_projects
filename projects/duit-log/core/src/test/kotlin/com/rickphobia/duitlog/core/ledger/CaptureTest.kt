package com.rickphobia.duitlog.core.ledger

import com.rickphobia.duitlog.core.reader.NotificationContent
import com.rickphobia.duitlog.core.reader.ReadKind
import com.rickphobia.duitlog.core.reader.Reading
import com.rickphobia.duitlog.core.reader.Wallet
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDateTime
import java.time.YearMonth

class CaptureTest {
    private val lunch = LocalDateTime.of(2026, 10, 12, 12, 30).atZone(KUALA_LUMPUR).toInstant()

    private fun payment(
        amountSen: Long = 1_250,
        postedAt: Instant = lunch,
        wallet: Wallet = Wallet.TNG,
        text: String = "Paid RM12.50 to Nasi Kandar Pelita",
    ) = Reading.Read(
        wallet,
        NotificationContent("Payment", text, "", postedAt),
        ReadKind.EXPENSE,
        amountSen,
        "Nasi Kandar Pelita",
    )

    private fun unreadable(
        text: String = "Something about RM8.00",
        postedAt: Instant = lunch,
    ) = Reading.Unreadable(Wallet.TNG, NotificationContent("TNG", text, "", postedAt))

    @Test
    fun `a captured payment is an Expense without a Category on the day it was posted`() {
        val ledger = newLedger()

        val captured = (ledger.captures.payment(payment()) as CaptureOutcome.Captured).transaction

        val shown =
            ledger
                .monthSummary(YearMonth.of(2026, 10))
                .days
                .single()
                .transactions
                .single()
        assertEquals(captured, shown)
        assertEquals(Kind.EXPENSE, shown.kind)
        assertEquals(1_250L, shown.amountSen)
        assertEquals(lunch, shown.occurredAt)
        assertEquals("Nasi Kandar Pelita", shown.merchant)
        assertEquals(Wallet.TNG, shown.wallet)
        assertNull(shown.categoryId)
        assertEquals("Payment\nPaid RM12.50 to Nasi Kandar Pelita", shown.originalText)
    }

    @Test
    fun `the same notification posted twice gives one Transaction`() {
        val ledger = newLedger()
        val first = (ledger.captures.payment(payment()) as CaptureOutcome.Captured).transaction

        assertEquals(CaptureOutcome.Duplicate(first.id), ledger.captures.payment(payment()))
        assertEquals(
            1,
            ledger
                .monthSummary(YearMonth.of(2026, 10))
                .days
                .single()
                .transactions.size,
        )
    }

    @Test
    fun `a notification updated in place a little later gives one Transaction`() {
        val ledger = newLedger()
        val first = (ledger.captures.payment(payment()) as CaptureOutcome.Captured).transaction

        val updated = payment(postedAt = lunch.plusSeconds(40), text = "Paid RM12.50 to Nasi Kandar Pelita. Thank you")

        assertEquals(CaptureOutcome.Duplicate(first.id), ledger.captures.payment(updated))
    }

    @Test
    fun `a captured Transaction edited by hand still catches its duplicate`() {
        val ledger = newLedger()
        val first = (ledger.captures.payment(payment()) as CaptureOutcome.Captured).transaction
        ledger.edit(
            first.id,
            HandEntry(
                kind = Kind.EXPENSE,
                amountSen = 1_250,
                occurredAt = LocalDateTime.of(2026, 10, 12, 8, 0),
                merchant = "Pelita",
                categoryId = ledger.categoryId(Kind.EXPENSE, "F&B"),
                note = null,
            ),
        )

        assertEquals(CaptureOutcome.Duplicate(first.id), ledger.captures.payment(payment()))
    }

    @Test
    fun `a different amount, Wallet or a later payment is a new Transaction`() {
        val ledger = newLedger()
        ledger.captures.payment(payment())

        assertTrue(ledger.captures.payment(payment(amountSen = 1_300)) is CaptureOutcome.Captured)
        assertTrue(ledger.captures.payment(payment(wallet = Wallet.GRAB)) is CaptureOutcome.Captured)
        val later = payment(postedAt = lunch + DUPLICATE_WINDOW.plusSeconds(1))
        assertTrue(ledger.captures.payment(later) is CaptureOutcome.Captured)
    }

    @Test
    fun `a hand-added Expense of the same amount at the same time is not a duplicate`() {
        val ledger = newLedger()
        ledger.add(Kind.EXPENSE, 1_250, LocalDateTime.of(2026, 10, 12, 12, 30))

        assertTrue(ledger.captures.payment(payment()) is CaptureOutcome.Captured)
    }

    @Test
    fun `an Unreadable notification is kept on the Couldn't read list with its text and time`() {
        val ledger = newLedger()

        val kept = (ledger.captures.unreadable(unreadable()) as KeepOutcome.Kept).entry

        assertEquals(listOf(kept), ledger.captures.couldntRead())
        assertEquals(Wallet.TNG, kept.wallet)
        assertEquals(lunch, kept.postedAt)
        assertEquals("TNG\nSomething about RM8.00", kept.originalText)
    }

    @Test
    fun `the same Unreadable notification posted twice is kept once`() {
        val ledger = newLedger()
        val kept = (ledger.captures.unreadable(unreadable()) as KeepOutcome.Kept).entry

        val again = unreadable(postedAt = lunch.plusSeconds(5))
        assertEquals(KeepOutcome.Duplicate(kept.id), ledger.captures.unreadable(again))
        assertTrue(ledger.captures.unreadable(unreadable(text = "Other words RM8.00")) is KeepOutcome.Kept)
        assertEquals(2, ledger.captures.couldntRead().size)
    }

    @Test
    fun `a Couldn't read entry can be removed once`() {
        val ledger = newLedger()
        val kept = (ledger.captures.unreadable(unreadable()) as KeepOutcome.Kept).entry

        ledger.captures.removeCouldntRead(kept.id)

        assertEquals(emptyList<CouldntRead>(), ledger.captures.couldntRead())
        assertThrows(LedgerException.UnknownCouldntRead::class.java) { ledger.captures.removeCouldntRead(kept.id) }
    }
}
