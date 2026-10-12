package com.rickphobia.duitlog.core.reader

import com.rickphobia.duitlog.core.ledger.LedgerException
import com.rickphobia.duitlog.core.ledger.Ringgit

/**
 * One known way a Wallet words a kind of notification. Each is written from a recorded sample and
 * matched against the notification's [NotificationContent.originalText]; null means "not this one".
 */
sealed interface Wording {
    fun read(
        wallet: Wallet,
        content: NotificationContent,
    ): Reading?

    /**
     * A payment. [pattern] must name an `amount` group ("12.50" or "1,234.00", without "RM") and a
     * `merchant` group. A match whose amount or Merchant can't be used is Unreadable rather than a
     * guess.
     */
    class Payment(
        private val pattern: Regex,
        private val kind: ReadKind = ReadKind.EXPENSE,
    ) : Wording {
        override fun read(
            wallet: Wallet,
            content: NotificationContent,
        ): Reading? {
            val match = pattern.find(content.originalText) ?: return null
            val merchant =
                match.groups["merchant"]
                    ?.value
                    ?.trim()
                    .orEmpty()
            val amountSen = sen(match.groups["amount"]?.value.orEmpty())
            return if (merchant.isEmpty() || amountSen <= 0) {
                Reading.Unreadable(wallet, content)
            } else {
                Reading.Read(wallet, content, kind, amountSen, merchant)
            }
        }

        // 0 for anything that isn't a ringgit amount, which the caller treats as unreadable.
        private fun sen(amount: String) =
            try {
                Ringgit.parse(amount)
            } catch (_: LedgerException.AmountUnreadable) {
                0L
            }
    }

    /** A notification that never becomes a Transaction, such as a Reload or a promotion. */
    class Skip(
        private val pattern: Regex,
        private val reason: IgnoreReason,
    ) : Wording {
        override fun read(
            wallet: Wallet,
            content: NotificationContent,
        ): Reading? =
            if (pattern.containsMatchIn(content.originalText)) Reading.Ignored(wallet, content, reason) else null
    }
}

/**
 * The wordings the app knows, per Wallet. A Wallet missing here isn't read yet. Order matters:
 * the first wording that matches decides, so the narrow ones (Reload, cashback) come before the
 * general payment one.
 */
object KnownWordings {
    // Filled from the owner's recorded TNG payments (test samples in core/src/test/resources/samples/tng).
    val TNG: List<Wording> = emptyList()

    val DEFAULT: Map<Wallet, List<Wording>> = mapOf(Wallet.TNG to TNG)
}
