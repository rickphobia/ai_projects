package com.rickphobia.gloss.core.settings

import com.rickphobia.gloss.core.spending.ModelPrice

/** What the Gloss core needs from the settings. The app holds the defaults (`PhoneSettings`). */
data class GlossSettings(
    val defineModel: String,
    /** What [defineModel] charges, to count each Define toward the Spending limit. */
    val definePrice: ModelPrice,
    /** A Define is one or two lines; this only stops a runaway answer from costing much. */
    val defineMaxTokens: Int,
    /** At most this many words of the chapter before the Selection go to the AI, to keep a Lookup cheap. */
    val contextWordLimit: Int,
    /** The Spending limit: the most Gloss may spend on the AI in a calendar month, in millionths of a dollar. */
    val spendingLimitMicros: Long,
)

/** The settings port: read on every call, so a change applies to the next Lookup. */
fun interface SettingsSource {
    fun current(): GlossSettings
}
