package com.rickphobia.gloss.core.lookup

import java.time.Instant

/** One Define with its answer, and when it was made. */
data class Lookup(
    val selection: String,
    val answer: String,
    val madeAt: Instant,
)

/** The storage port for Lookups. */
interface LookupStore {
    suspend fun save(lookup: Lookup)

    /** Every Lookup, oldest first. */
    suspend fun all(): List<Lookup>
}
