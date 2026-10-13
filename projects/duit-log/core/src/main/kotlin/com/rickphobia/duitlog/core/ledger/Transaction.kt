package com.rickphobia.duitlog.core.ledger

import com.rickphobia.duitlog.core.reader.Wallet
import java.time.Instant
import java.time.LocalDateTime

/**
 * One logged Expense or Income. [amountSen] is always positive; [kind] gives its direction. An
 * [excluded] Transaction stays in the list but counts in no total. A captured one has the [wallet]
 * whose notification it came from and that notification's [originalText]; one added by hand has
 * neither. A captured one starts without a Category.
 */
data class Transaction(
    val id: Long,
    val kind: Kind,
    val amountSen: Long,
    val occurredAt: Instant,
    val merchant: String,
    val categoryId: Long?,
    val categoryName: String?,
    val note: String?,
    val excluded: Boolean = false,
    val wallet: Wallet? = null,
    val originalText: String? = null,
)

/**
 * A Transaction typed in with the + button, or the new fields of one being edited. [occurredAt] is
 * the date and time as the user picked them, on the phone's clock.
 */
data class HandEntry(
    val kind: Kind,
    val amountSen: Long,
    val occurredAt: LocalDateTime,
    val merchant: String,
    val categoryId: Long,
    val note: String?,
)
