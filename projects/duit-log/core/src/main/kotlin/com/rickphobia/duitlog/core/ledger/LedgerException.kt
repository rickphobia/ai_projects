package com.rickphobia.duitlog.core.ledger

/** The Ledger's own refusals, so the screens can tell the user what to fix. */
sealed class LedgerException(
    message: String,
) : IllegalArgumentException(message) {
    class AmountNotPositive(
        amountSen: Long,
    ) : LedgerException("an amount must be more than RM0.00, got $amountSen sen")

    /** The typed text isn't a ringgit amount such as 12.30. The text itself is left out of the message. */
    class AmountUnreadable : LedgerException("not a ringgit amount with at most two decimals")

    class MerchantMissing : LedgerException("a Transaction needs a Merchant")

    class UnknownCategory(
        categoryId: Long,
    ) : LedgerException("no Category with id $categoryId")

    class CategoryKindMismatch(
        category: Category,
        kind: Kind,
    ) : LedgerException("Category ${category.id} is in the ${category.kind} list, not $kind")
}
