package com.rickphobia.gloss.core.settings

/** What the Gloss core needs from the settings. The app holds the defaults (`PhoneSettings`). */
data class GlossSettings(
    val defineModel: String,
    /** A Define is one or two lines; this only stops a runaway answer from costing much. */
    val defineMaxTokens: Int,
    /** At most this many words of the chapter before the Selection go to the AI, to keep a Lookup cheap. */
    val contextWordLimit: Int,
)

/** The settings port: read on every call, so a change applies to the next Lookup. */
fun interface SettingsSource {
    fun current(): GlossSettings
}
