package com.rickphobia.duitlog.core.ledger

import com.rickphobia.duitlog.core.storage.DuitLogDatabase
import com.rickphobia.duitlog.core.summary.MonthSummary
import com.rickphobia.duitlog.core.summary.summarizeMonth
import java.time.Clock
import java.time.Instant
import java.time.YearMonth

/**
 * Everything the app decides about money goes through here; the screens and Android adapters talk
 * only to the Ledger. [clock] gives "now" and the phone's time zone, which decides the day and
 * Month every Transaction falls in.
 */
class Ledger(
    private val database: DuitLogDatabase,
    private val clock: Clock,
) {
    fun categories(kind: Kind): List<Category> =
        database.categoryQueries.ofKind(kind.name, ::toCategory).executeAsList()

    /** Saves [entry] and returns it as a Transaction, or throws a [LedgerException] and saves nothing. */
    fun addByHand(entry: HandEntry): Transaction {
        if (entry.amountSen <= 0) throw LedgerException.AmountNotPositive(entry.amountSen)
        val merchant = entry.merchant.trim()
        if (merchant.isEmpty()) throw LedgerException.MerchantMissing()
        val category = categoryFor(entry)
        val occurredAt = entry.occurredAt.atZone(clock.zone).toInstant()
        val note = entry.note?.trim()?.takeIf(String::isNotEmpty)

        val queries = database.ledgerTransactionQueries
        val id =
            database.transactionWithResult {
                queries.insert(entry.kind.name, entry.amountSen, occurredAt.toEpochMilli(), merchant, category.id, note)
                queries.lastInsertedId().executeAsOne()
            }
        return Transaction(id, entry.kind, entry.amountSen, occurredAt, merchant, category.name, note)
    }

    fun currentMonth(): YearMonth = YearMonth.now(clock)

    fun monthSummary(month: YearMonth): MonthSummary {
        val zone = clock.zone
        val from = month.atDay(1).atStartOfDay(zone).toInstant()
        val until =
            month
                .plusMonths(1)
                .atDay(1)
                .atStartOfDay(zone)
                .toInstant()
        val transactions =
            database.ledgerTransactionQueries
                .between(
                    from.toEpochMilli(),
                    until.toEpochMilli(),
                ) { id, kind, amountSen, occurredAt, merchant, categoryName, note ->
                    Transaction(
                        id,
                        Kind.valueOf(kind),
                        amountSen,
                        Instant.ofEpochMilli(occurredAt),
                        merchant,
                        categoryName,
                        note,
                    )
                }.executeAsList()
        return summarizeMonth(month, transactions, zone)
    }

    /** The entry's Category, which must exist and be in the list of the entry's kind. */
    private fun categoryFor(entry: HandEntry): Category {
        val category =
            database.categoryQueries.byId(entry.categoryId, ::toCategory).executeAsOneOrNull()
                ?: throw LedgerException.UnknownCategory(entry.categoryId)
        if (category.kind != entry.kind) throw LedgerException.CategoryKindMismatch(category, entry.kind)
        return category
    }

    private fun toCategory(
        id: Long,
        kind: String,
        name: String,
    ) = Category(id, Kind.valueOf(kind), name)
}
