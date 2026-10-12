package com.rickphobia.duitlog.core.ledger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RinggitTest {
    @Test
    fun `amounts are shown as RM with two decimals`() {
        assertEquals("RM0.00", Ringgit.format(0))
        assertEquals("RM0.05", Ringgit.format(5))
        assertEquals("RM12.30", Ringgit.format(1_230))
        assertEquals("RM1,230.45", Ringgit.format(123_045))
        assertEquals("RM1,000,000.00", Ringgit.format(100_000_000))
    }

    @Test
    fun `a negative amount gets a minus sign before RM`() {
        assertEquals("-RM12.30", Ringgit.format(-1_230))
    }

    @Test
    fun `typed amounts are read as whole sen`() {
        assertEquals(1_200L, Ringgit.parse("12"))
        assertEquals(1_230L, Ringgit.parse("12.3"))
        assertEquals(1_234L, Ringgit.parse("12.34"))
        assertEquals(50L, Ringgit.parse(".5"))
        assertEquals(5L, Ringgit.parse(" 0.05 "))
        assertEquals(123_450L, Ringgit.parse("1,234.50"))
        assertEquals(1_200L, Ringgit.parse("12."))
    }

    @Test
    fun `0_1 plus 0_2 is exactly 30 sen`() {
        assertEquals(30L, Ringgit.parse("0.1") + Ringgit.parse("0.2"))
    }

    @Test
    fun `anything that isn't a plain ringgit amount is refused`() {
        listOf("", " ", "abc", "12.345", "-5", "1e3", "12.3.4", ".", "RM12", "1234567890123").forEach { typed ->
            assertThrows("'$typed' should be refused", LedgerException.AmountUnreadable::class.java) {
                Ringgit.parse(typed)
            }
        }
    }
}
