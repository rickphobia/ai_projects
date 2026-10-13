package com.rickphobia.duitlog.core.reader

import java.time.Instant

/**
 * What a posted notification says, when it was posted, and Android's key for it. Posting the same
 * key again is a re-post or an update in place; two payments get two keys, even seconds apart.
 */
data class NotificationContent(
    val title: String,
    val text: String,
    val expandedText: String,
    val postedAt: Instant,
    val notificationKey: String,
) {
    /** Every part that has words, one per line, as the Transaction's details show it. */
    val originalText: String
        get() = listOf(title, text, expandedText).filter(String::isNotBlank).distinct().joinToString("\n")
}

/**
 * Turns a posted notification into a [Reading]. Its first step decides "Not a Wallet" from the
 * posting app alone; the content is only fetched after that, so no text from any other app is
 * ever read. Then each of the Wallet's [wordings] is tried in order; a Wallet with no wordings
 * isn't read yet.
 */
class NotificationReader(
    private val walletApps: WalletApps,
    private val wordings: Map<Wallet, List<Wording>> = KnownWordings.DEFAULT,
) {
    fun read(
        packageName: String,
        content: () -> NotificationContent,
    ): Reading {
        val wallet = walletApps.walletFor(packageName) ?: return Reading.NotAWallet
        return readWallet(wallet, content())
    }

    private fun readWallet(
        wallet: Wallet,
        posted: NotificationContent,
    ): Reading {
        val known = wordings[wallet] ?: return Reading.Ignored(wallet, posted, IgnoreReason.WALLET_NOT_READ_YET)
        return known.firstNotNullOfOrNull { it.read(wallet, posted) }
            ?: if (mentionsAmount(posted)) {
                Reading.Unreadable(wallet, posted)
            } else {
                Reading.Ignored(wallet, posted, IgnoreReason.NOTHING_MONEY_RELATED)
            }
    }

    private fun mentionsAmount(content: NotificationContent) = AMOUNT.containsMatchIn(content.originalText)

    private companion object {
        // "RM12.50", "RM 1,234.00", "rm5": any ringgit sign followed by a number.
        val AMOUNT = Regex("""RM\s?\d""", RegexOption.IGNORE_CASE)
    }
}
