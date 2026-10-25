package com.rickphobia.gloss.core.lookup

import com.rickphobia.gloss.core.storage.GlossDatabase
import java.time.Instant

/**
 * Lookups in the app's SQLite database. The calls block, so the caller runs them off the main
 * thread.
 */
class SqlLookupStore(
    private val database: GlossDatabase,
) : LookupStore {
    override suspend fun save(lookup: Lookup): Long =
        database.lookupQueries.transactionWithResult {
            database.lookupQueries.insert(
                lookup.selection,
                lookup.answer,
                lookup.madeAt.toEpochMilli(),
                kindColumn(lookup.kind),
            )
            val id = database.lookupQueries.lastId().executeAsOne()
            lookup.followUps.forEach { database.lookupQueries.insertFollowUp(id, it.question, it.answer) }
            id
        }

    override suspend fun addFollowUp(
        lookupId: Long,
        followUp: FollowUp,
    ) {
        database.lookupQueries.insertFollowUp(lookupId, followUp.question, followUp.answer)
    }

    override suspend fun all(): List<Lookup> {
        val followUps =
            database.lookupQueries
                .allFollowUps { lookupId, question, answer -> lookupId to FollowUp(question, answer) }
                .executeAsList()
                .groupBy({ it.first }, { it.second })
        return database.lookupQueries
            .all { id, selection, answer, madeAt, kind ->
                Lookup(selection, answer, Instant.ofEpochMilli(madeAt), kindOf(kind), followUps[id].orEmpty())
            }.executeAsList()
    }

    private fun kindColumn(kind: LookupKind): String =
        when (kind) {
            LookupKind.Define -> DEFINE
            LookupKind.Explain -> EXPLAIN
        }

    private fun kindOf(column: String): LookupKind =
        when (column) {
            EXPLAIN -> LookupKind.Explain
            DEFINE -> LookupKind.Define
            else -> error("Unknown Lookup kind in the database: $column")
        }

    private companion object {
        // The values in the lookup table's kind column; spelled out so renaming the enum can't change them.
        const val DEFINE = "define"
        const val EXPLAIN = "explain"
    }
}
