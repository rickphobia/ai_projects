package com.rickphobia.duitlog.core.ledger

import com.rickphobia.duitlog.core.storage.DuitLogDatabase
import com.rickphobia.duitlog.core.summary.MonthSummary
import com.rickphobia.duitlog.core.summary.summarizeMonth
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.temporal.ChronoUnit

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
        val checked = database.check(entry, clock.zone)
        val queries = database.ledgerTransactionQueries
        val id =
            database.transactionWithResult {
                queries.insert(
                    entry.kind.name,
                    entry.amountSen,
                    checked.occurredAt.toEpochMilli(),
                    checked.merchant,
                    checked.category.id,
                    checked.note,
                )
                queries.lastInsertedId().executeAsOne()
            }
        return transaction(id)
    }

    /** The Transaction with [id], or [LedgerException.UnknownTransaction]. */
    fun transaction(id: Long): Transaction =
        database.ledgerTransactionQueries.byId(id, ::toTransaction).executeAsOneOrNull()
            ?: throw LedgerException.UnknownTransaction(id)

    /**
     * Replaces every field of Transaction [id] with [entry]'s, checked as for [addByHand]; whether
     * it is Excluded stays as it was.
     */
    fun edit(
        id: Long,
        entry: HandEntry,
    ): Transaction {
        val checked = database.check(entry, clock.zone)
        database.changeOne(id) {
            update(
                entry.kind.name,
                entry.amountSen,
                checked.occurredAt.toEpochMilli(),
                checked.merchant,
                checked.category.id,
                checked.note,
                id,
            )
        }
        return transaction(id)
    }

    /** A blank [note] removes the Note. */
    fun setNote(
        id: Long,
        note: String?,
    ): Transaction {
        database.changeOne(id) { setNote(cleanNote(note), id) }
        return transaction(id)
    }

    fun setExcluded(
        id: Long,
        excluded: Boolean,
    ): Transaction {
        database.changeOne(id) { setExcluded(if (excluded) 1L else 0L, id) }
        return transaction(id)
    }

    fun delete(id: Long) {
        database.changeOne(id) { delete(id) }
    }

    fun currentMonth(): YearMonth = YearMonth.now(clock)

    /** Now on the phone's clock, for the date and time a new Transaction starts with. */
    fun now(): LocalDateTime = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MINUTES)

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
                .between(from.toEpochMilli(), until.toEpochMilli(), ::toTransaction)
                .executeAsList()
        return summarizeMonth(month, transactions, zone)
    }
}
