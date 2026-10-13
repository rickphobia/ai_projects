package com.rickphobia.duitlog.core.reader

/** What the Notification Reader made of a notification. */
sealed interface Reading {
    /**
     * Posted by an app that isn't a Wallet. The caller drops the notification at once: it is
     * never saved, logged or counted (decision 0003).
     */
    data object NotAWallet : Reading

    /** Posted by a Wallet app: read, ignored or unreadable. */
    sealed interface FromWallet : Reading {
        val wallet: Wallet
        val content: NotificationContent
    }

    /** A payment the Reader understood. [amountSen] is positive; [merchant] is never blank. */
    data class Read(
        override val wallet: Wallet,
        override val content: NotificationContent,
        val kind: ReadKind,
        val amountSen: Long,
        val merchant: String,
    ) : FromWallet

    data class Ignored(
        override val wallet: Wallet,
        override val content: NotificationContent,
        val reason: IgnoreReason,
    ) : FromWallet

    /** Mentions an amount but matches no known wording; it goes to the "Couldn't read" list. */
    data class Unreadable(
        override val wallet: Wallet,
        override val content: NotificationContent,
    ) : FromWallet
}

/** Which way a read notification's money went. Transfers (ticket 11) and Refunds (ticket 13) come later. */
enum class ReadKind {
    EXPENSE,
}

/** Why a Wallet notification doesn't become a Transaction. */
enum class IgnoreReason {
    /** Moving your own money into the Wallet isn't spending. */
    RELOAD,
    PROMOTION,
    CASHBACK,
    NOTHING_MONEY_RELATED,

    /** The Wallet's wording isn't known yet (Grab is ticket 09, Shopee ticket 10). */
    WALLET_NOT_READ_YET,
}
