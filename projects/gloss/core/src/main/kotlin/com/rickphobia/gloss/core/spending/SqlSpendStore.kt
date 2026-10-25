package com.rickphobia.gloss.core.spending

import com.rickphobia.gloss.core.storage.GlossDatabase
import java.time.Instant

/** What AI calls cost, in the app's SQLite database. The calls block, so run them off the main thread. */
class SqlSpendStore(
    private val database: GlossDatabase,
) : SpendStore {
    override suspend fun add(
        costMicros: Long,
        at: Instant,
    ) {
        database.spendQueries.insert(costMicros, at.toEpochMilli())
    }

    override suspend fun totalBetween(
        from: Instant,
        until: Instant,
    ): Long = database.spendQueries.totalBetween(from.toEpochMilli(), until.toEpochMilli()).executeAsOne()
}
