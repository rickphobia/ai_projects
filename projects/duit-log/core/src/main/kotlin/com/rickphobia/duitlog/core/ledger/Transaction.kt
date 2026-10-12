package com.rickphobia.duitlog.core.ledger

import java.time.Instant
import java.time.LocalDateTime

/** One logged Expense or Income. [amountSen] is always positive; [kind] gives its direction. */
data class Transaction(
    val id: Long,
    val kind: Kind,
    val amountSen: Long,
    val occurredAt: Instant,
    val merchant: String,
    val categoryName: String?,
    val note: String?,
)

/**
 * A Transaction typed in with the + button. [occurredAt] is the date and time as the user picked
 * them, on the phone's clock.
 */
data class HandEntry(
    val kind: Kind,
    val amountSen: Long,
    val occurredAt: LocalDateTime,
    val merchant: String,
    val categoryId: Long,
    val note: String?,
)
