package com.rickphobia.duitlog.core.reader

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class NotificationReaderTest {
    private val reader = NotificationReader(WalletApps.DEFAULT)

    private fun notification(
        packageName: String,
        title: String = "Payment successful",
        text: String = "You have paid RM12.50 to Nasi Kandar Pelita",
        expandedText: String = "You have paid RM12.50 to Nasi Kandar Pelita using your eWallet balance",
    ) = RawNotification(
        packageName = packageName,
        title = title,
        text = text,
        expandedText = expandedText,
        postedAt = Instant.parse("2026-10-12T04:30:00Z"),
    )

    @Test
    fun `a WhatsApp message is Not a Wallet even when it reads like a payment`() {
        val whatsApp = notification("com.whatsapp", title = "Ali", text = "You have paid RM12.50 to Touch 'n Go")

        assertEquals(Reading.NotAWallet, reader.read(whatsApp))
    }

    @Test
    fun `a bank alert is Not a Wallet even when it mentions a Wallet and an amount`() {
        val bank =
            notification(
                "com.maybank2u.life",
                title = "Transfer successful",
                text = "RM50.00 transferred to TNG eWallet. TAC 123456",
            )

        assertEquals(Reading.NotAWallet, reader.read(bank))
    }

    @Test
    fun `an app whose package name only starts like a Wallet's is Not a Wallet`() {
        assertEquals(Reading.NotAWallet, reader.read(notification("my.com.tngdigital.ewallet.fake")))
    }

    @Test
    fun `each Wallet app's notification is kept with its Wallet`() {
        val expected =
            mapOf(
                "my.com.tngdigital.ewallet" to Wallet.TNG,
                "com.grabtaxi.passenger" to Wallet.GRAB,
                "com.shopee.my" to Wallet.SHOPEE,
            )

        expected.forEach { (packageName, wallet) ->
            val raw = notification(packageName)
            assertEquals(Reading.FromWallet(wallet, raw), reader.read(raw))
        }
    }

    @Test
    fun `every Wallet has an app`() {
        assertEquals(
            Wallet.entries.toSet(),
            WalletApps.DEFAULT.packages.values
                .toSet(),
        )
    }
}
