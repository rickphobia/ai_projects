package com.rickphobia.gloss.core.settings

import com.rickphobia.gloss.core.spending.ModelPrice

/** What the Gloss core needs from the settings. The app holds the defaults (`PhoneSettings`). */
data class GlossSettings(
    val defineModel: String,
    /** What [defineModel] charges, to count each Define toward the Spending limit. */
    val definePrice: ModelPrice,
    /** A Define is one or two lines; this only stops a runaway answer from costing much. */
    val defineMaxTokens: Int,
    /** The model for Explain and its follow-ups. */
    val explainModel: String,
    /** What [explainModel] charges. */
    val explainPrice: ModelPrice,
    /** Room for the model's thinking and a short paragraph; this only stops a runaway answer. */
    val explainMaxTokens: Int,
    /** How hard [explainModel] thinks, such as "low": a short, simple paragraph needs little. */
    val explainEffort: String,
    /** At most this many words of the chapter before the Selection go to the AI, to keep a Lookup cheap. */
    val contextWordLimit: Int,
    /** The Spending limit: the most Gloss may spend on the AI in a calendar month, in millionths of a dollar. */
    val spendingLimitMicros: Long,
)

/** The settings port: read on every call, so a change applies to the next Lookup. */
fun interface SettingsSource {
    fun current(): GlossSettings
}
