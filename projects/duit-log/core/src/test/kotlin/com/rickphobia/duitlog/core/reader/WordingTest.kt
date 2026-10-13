package com.rickphobia.duitlog.core.reader

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

/** How wordings are tried, using made-up wordings; the real TNG ones are tested in TngSamplesTest. */
class WordingTest {
    private val reader =
        NotificationReader(
            WalletApps.DEFAULT,
            mapOf(
                Wallet.TNG to
                    listOf(
                        Wording.Skip(Regex("""Topped up"""), IgnoreReason.RELOAD),
                        Wording.Payment(Regex("""Paid RM(?<amount>[\d,.]+) to (?<merchant>.*)""")),
                    ),
            ),
        )

    private fun tng(text: String) = reader.read("my.com.tngdigital.ewallet") { content(text) }

    private fun content(text: String) =
        NotificationContent("Wallet", text, "", Instant.parse("2026-10-12T04:30:00Z"), "0|key")

    @Test
    fun `a payment wording gives the amount in sen and the Merchant`() {
        assertEquals(
            Reading.Read(Wallet.TNG, content("Paid RM1,234.50 to Kedai Ali "), ReadKind.EXPENSE, 123_450, "Kedai Ali"),
            tng("Paid RM1,234.50 to Kedai Ali "),
        )
    }

    @Test
    fun `the first wording that matches decides`() {
        assertEquals(
            Reading.Ignored(Wallet.TNG, content("Topped up. Paid RM5.00 to Kedai Ali"), IgnoreReason.RELOAD),
            tng("Topped up. Paid RM5.00 to Kedai Ali"),
        )
    }

    @Test
    fun `a payment match without a Merchant is Unreadable, not a guess`() {
        assertEquals(Reading.Unreadable(Wallet.TNG, content("Paid RM5.00 to ")), tng("Paid RM5.00 to "))
    }

    @Test
    fun `a payment match with an amount that isn't ringgit is Unreadable`() {
        assertEquals(Reading.Unreadable(Wallet.TNG, content("Paid RM5.0.0 to Kedai")), tng("Paid RM5.0.0 to Kedai"))
    }

    @Test
    fun `unknown wording that mentions an amount is Unreadable`() {
        assertEquals(Reading.Unreadable(Wallet.TNG, content("You spent RM 8 at Kedai")), tng("You spent RM 8 at Kedai"))
    }

    @Test
    fun `unknown wording with no amount is nothing money-related`() {
        assertEquals(
            Reading.Ignored(Wallet.TNG, content("Your eKYC is verified"), IgnoreReason.NOTHING_MONEY_RELATED),
            tng("Your eKYC is verified"),
        )
    }

    @Test
    fun `the original text has each part once, one per line`() {
        val posted = NotificationContent("Paid", "RM5.00 to Kedai", "RM5.00 to Kedai", Instant.EPOCH, "0|key")

        assertEquals("Paid\nRM5.00 to Kedai", posted.originalText)
    }
}
