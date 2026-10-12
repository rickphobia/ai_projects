package com.rickphobia.duitlog.core.ledger

import com.rickphobia.duitlog.core.reader.Wallet
import com.rickphobia.duitlog.core.storage.DuitLogDatabase
import com.rickphobia.duitlog.core.storage.LedgerTransactionQueries
import java.time.Instant
import java.time.ZoneId

// The Ledger's checks and its mapping between database rows and Transactions.

/** Runs [change] on one row, or throws [LedgerException.UnknownTransaction] if no row has [id]. */
internal fun DuitLogDatabase.changeOne(
    id: Long,
    change: LedgerTransactionQueries.() -> Unit,
) {
    val queries = ledgerTransactionQueries
    val changed =
        transactionWithResult {
            queries.change()
            queries.changes().executeAsOne()
        }
    if (changed == 0L) throw LedgerException.UnknownTransaction(id)
}

/** [entry] as it will be saved, or the [LedgerException] that refuses it. [zone] gives its moment. */
internal fun DuitLogDatabase.check(
    entry: HandEntry,
    zone: ZoneId,
): CheckedEntry {
    if (entry.amountSen <= 0) throw LedgerException.AmountNotPositive(entry.amountSen)
    val merchant = entry.merchant.trim()
    if (merchant.isEmpty()) throw LedgerException.MerchantMissing()
    return CheckedEntry(
        occurredAt = entry.occurredAt.atZone(zone).toInstant(),
        merchant = merchant,
        category = categoryFor(entry),
        note = cleanNote(entry.note),
    )
}

internal class CheckedEntry(
    val occurredAt: Instant,
    val merchant: String,
    val category: Category,
    val note: String?,
)

internal fun cleanNote(note: String?): String? = note?.trim()?.takeIf(String::isNotEmpty)

/** The entry's Category, which must exist and be in the list of the entry's kind. */
private fun DuitLogDatabase.categoryFor(entry: HandEntry): Category {
    val category =
        categoryQueries.byId(entry.categoryId, ::toCategory).executeAsOneOrNull()
            ?: throw LedgerException.UnknownCategory(entry.categoryId)
    if (category.kind != entry.kind) throw LedgerException.CategoryKindMismatch(category, entry.kind)
    return category
}

@Suppress("LongParameterList") // one parameter per column, as SQLDelight's mappers take them
internal fun toTransaction(
    id: Long,
    kind: String,
    amountSen: Long,
    occurredAt: Long,
    merchant: String,
    categoryId: Long?,
    categoryName: String?,
    note: String?,
    excluded: Long,
    wallet: String?,
    originalText: String?,
) = Transaction(
    id,
    Kind.valueOf(kind),
    amountSen,
    Instant.ofEpochMilli(occurredAt),
    merchant,
    categoryId,
    categoryName,
    note,
    excluded == 1L,
    wallet?.let(Wallet::valueOf),
    originalText,
)

internal fun toCategory(
    id: Long,
    kind: String,
    name: String,
) = Category(id, Kind.valueOf(kind), name)
