package com.rickphobia.duitlog.core.reader

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class NotificationReaderTest {
    private val reader = NotificationReader(WalletApps.DEFAULT)

    private fun content(
        title: String = "Payment successful",
        text: String = "You have paid RM12.50 to Nasi Kandar Pelita",
    ) = NotificationContent(
        title = title,
        text = text,
        expandedText = "$text using your eWallet balance",
        postedAt = Instant.parse("2026-10-12T04:30:00Z"),
    )

    @Test
    fun `a WhatsApp message is Not a Wallet even when it reads like a payment`() {
        val whatsApp = content(title = "Ali", text = "You have paid RM12.50 to Touch 'n Go")

        assertEquals(Reading.NotAWallet, reader.read("com.whatsapp") { whatsApp })
    }

    @Test
    fun `a bank alert is Not a Wallet even when it mentions a Wallet and an amount`() {
        val bank = content(title = "Transfer successful", text = "RM50.00 transferred to TNG eWallet. TAC 123456")

        assertEquals(Reading.NotAWallet, reader.read("com.maybank2u.life") { bank })
    }

    @Test
    fun `a notification from another app is dropped without its text being read`() {
        reader.read("com.whatsapp") { throw AssertionError("read the text of a notification that isn't a Wallet's") }
    }

    @Test
    fun `an app whose package name only starts like a Wallet's is Not a Wallet`() {
        assertEquals(Reading.NotAWallet, reader.read("my.com.tngdigital.ewallet.fake") { content() })
    }

    @Test
    fun `each Wallet app's notification is read as its Wallet's`() {
        val expected =
            mapOf(
                "my.com.tngdigital.ewallet" to Wallet.TNG,
                "com.grabtaxi.passenger" to Wallet.GRAB,
                "com.shopee.my" to Wallet.SHOPEE,
            )

        expected.forEach { (packageName, wallet) ->
            val reading = reader.read(packageName) { content() }
            assertEquals(wallet, (reading as Reading.FromWallet).wallet)
        }
    }

    @Test
    fun `a Wallet with no known wordings isn't read yet`() {
        val reading = reader.read("com.grabtaxi.passenger") { content() }

        assertEquals(Reading.Ignored(Wallet.GRAB, content(), IgnoreReason.WALLET_NOT_READ_YET), reading)
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
