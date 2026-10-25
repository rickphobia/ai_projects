package com.rickphobia.gloss.core.lookup

import java.time.Instant

/** One Define or Explain with its answer, any follow-ups, and when it was made. */
data class Lookup(
    val selection: String,
    val answer: String,
    val madeAt: Instant,
    val kind: LookupKind = LookupKind.Define,
    /** An Explain chat's questions and answers after the first answer, oldest first. */
    val followUps: List<FollowUp> = emptyList(),
)

enum class LookupKind { Define, Explain }

/** A question the owner asked in an Explain chat, and the AI's answer. */
data class FollowUp(
    val question: String,
    val answer: String,
)

/** The storage port for Lookups. */
interface LookupStore {
    /** Saves [lookup] and returns its id, for adding follow-ups to it. */
    suspend fun save(lookup: Lookup): Long

    suspend fun addFollowUp(
        lookupId: Long,
        followUp: FollowUp,
    )

    /** Every Lookup with its follow-ups, oldest first. */
    suspend fun all(): List<Lookup>
}
