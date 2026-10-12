package com.rickphobia.duitlog.core.ledger

import com.rickphobia.duitlog.core.reader.ReadKind
import com.rickphobia.duitlog.core.reader.Reading
import com.rickphobia.duitlog.core.reader.Wallet
import com.rickphobia.duitlog.core.storage.DuitLogDatabase
import java.time.Duration
import java.time.Instant

/**
 * How far apart two postings of the same thing can be and still count as one. Wallets post a
 * notification again or update it in place within seconds, and Android gives each posting its own
 * time; two real payments of the same amount in the same Wallet this close together are rare
 * enough to accept losing one.
 */
val DUPLICATE_WINDOW: Duration = Duration.ofMinutes(2)

/** What capturing a read notification did. */
sealed interface CaptureOutcome {
    data class Captured(
        val transaction: Transaction,
    ) : CaptureOutcome

    /** Transaction [existingId] came from the same notification, posted earlier. Nothing was saved. */
    data class Duplicate(
        val existingId: Long,
    ) : CaptureOutcome
}

/** A Wallet notification on the "Couldn't read" list. */
data class CouldntRead(
    val id: Long,
    val wallet: Wallet,
    val postedAt: Instant,
    val originalText: String,
)

/** What keeping an Unreadable notification did. */
sealed interface KeepOutcome {
    data class Kept(
        val entry: CouldntRead,
    ) : KeepOutcome

    /** Entry [existingId] has the same words from the same Wallet, posted earlier. Nothing was saved. */
    data class Duplicate(
        val existingId: Long,
    ) : KeepOutcome
}

/**
 * Saves what the Notification Reader read: payments as Transactions, and Unreadable notifications
 * on the "Couldn't read" list, where they stay until the user adds them by hand or dismisses them.
 */
class Captures internal constructor(
    private val database: DuitLogDatabase,
) {
    /**
     * Saves [read] as a new Transaction without a Category, at its posting time; or, when a
     * Transaction from the same Wallet with the same kind and amount was posted within
     * [DUPLICATE_WINDOW], saves nothing.
     */
    fun payment(read: Reading.Read): CaptureOutcome {
        val kind =
            when (read.kind) {
                ReadKind.EXPENSE -> Kind.EXPENSE
            }
        val postedAt = read.content.postedAt
        val queries = database.ledgerTransactionQueries
        return database.transactionWithResult {
            val existing =
                queries
                    .capturedBetween(
                        read.wallet.name,
                        kind.name,
                        read.amountSen,
                        (postedAt - DUPLICATE_WINDOW).toEpochMilli(),
                        (postedAt + DUPLICATE_WINDOW).toEpochMilli(),
                    ).executeAsOneOrNull()
            if (existing != null) {
                CaptureOutcome.Duplicate(existing)
            } else {
                queries.insertCaptured(
                    kind.name,
                    read.amountSen,
                    postedAt.toEpochMilli(),
                    read.merchant,
                    read.wallet.name,
                    postedAt.toEpochMilli(),
                    read.content.originalText,
                )
                val id = queries.lastInsertedId().executeAsOne()
                CaptureOutcome.Captured(queries.byId(id, ::toTransaction).executeAsOne())
            }
        }
    }

    /** The "Couldn't read" list, newest first. */
    fun couldntRead(): List<CouldntRead> = database.couldntReadQueries.all(::toCouldntRead).executeAsList()

    /** Keeps [unreadable], unless the same words from the same Wallet were posted within [DUPLICATE_WINDOW]. */
    fun unreadable(unreadable: Reading.Unreadable): KeepOutcome {
        val queries = database.couldntReadQueries
        val postedAt = unreadable.content.postedAt
        val text = unreadable.content.originalText
        return database.transactionWithResult {
            val existing =
                queries
                    .sameWordsBetween(
                        unreadable.wallet.name,
                        text,
                        (postedAt - DUPLICATE_WINDOW).toEpochMilli(),
                        (postedAt + DUPLICATE_WINDOW).toEpochMilli(),
                    ).executeAsOneOrNull()
            if (existing != null) {
                KeepOutcome.Duplicate(existing)
            } else {
                queries.insert(unreadable.wallet.name, postedAt.toEpochMilli(), text)
                val id = queries.lastInsertedId().executeAsOne()
                KeepOutcome.Kept(CouldntRead(id, unreadable.wallet, postedAt, text))
            }
        }
    }

    /** Removes entry [id], once added by hand or dismissed. Throws [LedgerException.UnknownCouldntRead]. */
    fun removeCouldntRead(id: Long) {
        val queries = database.couldntReadQueries
        val removed =
            database.transactionWithResult {
                queries.delete(id)
                queries.changes().executeAsOne()
            }
        if (removed == 0L) throw LedgerException.UnknownCouldntRead(id)
    }
}

private fun toCouldntRead(
    id: Long,
    wallet: String,
    postedAt: Long,
    originalText: String,
) = CouldntRead(id, Wallet.valueOf(wallet), Instant.ofEpochMilli(postedAt), originalText)
