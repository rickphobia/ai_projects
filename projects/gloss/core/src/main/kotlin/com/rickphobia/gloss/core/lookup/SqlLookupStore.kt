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
    override suspend fun save(lookup: Lookup) {
        database.lookupQueries.insert(lookup.selection, lookup.answer, lookup.madeAt.toEpochMilli())
    }

    override suspend fun all(): List<Lookup> =
        database.lookupQueries
            .all { selection, answer, madeAt -> Lookup(selection, answer, Instant.ofEpochMilli(madeAt)) }
            .executeAsList()
}
