package com.rickphobia.duitlog.core.reader

import java.time.Instant

/** What a posted notification says, and when it was posted. */
data class NotificationContent(
    val title: String,
    val text: String,
    val expandedText: String,
    val postedAt: Instant,
)

/** What the Notification Reader made of a notification. */
sealed interface Reading {
    /**
     * Posted by an app that isn't a Wallet. The caller drops the notification at once: it is
     * never saved, logged or counted (decision 0003).
     */
    data object NotAWallet : Reading

    /**
     * Posted by a Wallet app. Ticket 06 onwards splits this into Read, Ignored and Unreadable;
     * until then the recorder keeps these so the Wallets' real wording can be collected.
     */
    data class FromWallet(
        val wallet: Wallet,
        val content: NotificationContent,
    ) : Reading
}

/**
 * Turns a posted notification into a [Reading]. Its first step decides "Not a Wallet" from the
 * posting app alone; the content is only fetched after that, so no text from any other app is
 * ever read.
 */
class NotificationReader(
    private val walletApps: WalletApps,
) {
    fun read(
        packageName: String,
        content: () -> NotificationContent,
    ): Reading {
        val wallet = walletApps.walletFor(packageName) ?: return Reading.NotAWallet
        return Reading.FromWallet(wallet, content())
    }
}
