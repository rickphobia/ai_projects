package com.rickphobia.gloss.core.lookup

import com.rickphobia.gloss.core.Saved
import com.rickphobia.gloss.core.context.BookLocation
import java.time.Instant

/**
 * One Define or Explain with its answer, any follow-ups, and when it was made. [book] is where its
 * Selection was found, or null without Book context ("No book").
 */
data class Lookup(
    val selection: String,
    val answer: String,
    val madeAt: Instant,
    val kind: LookupKind = LookupKind.Define,
    /** An Explain chat's questions and answers after the first answer, oldest first. */
    val followUps: List<FollowUp> = emptyList(),
    val book: BookLocation? = null,
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

    /** Every Lookup with its id and follow-ups, oldest first. */
    suspend fun all(): List<Saved<Lookup>>

    /** Deletes the Lookup [id] with its follow-ups and the Notes written on it, all or nothing. */
    suspend fun delete(id: Long)
}
