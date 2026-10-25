package com.rickphobia.gloss.settings

import com.rickphobia.gloss.core.settings.GlossSettings
import com.rickphobia.gloss.core.settings.SettingsSource

/**
 * The settings module: every model name, address and timeout Gloss uses, with its defaults built
 * in. Nothing here can be changed on the phone yet.
 */
object PhoneSettings : SettingsSource {
    const val DEFINE_MODEL = "claude-haiku-5-5"
    const val DEFINE_MAX_TOKENS = 150

    /** About 4,000 tokens of the chapter: enough for references back, and a Define stays cheap. */
    const val CONTEXT_WORD_LIMIT = 3_000

    val anthropic =
        AnthropicSettings(
            baseUrl = "https://api.anthropic.com",
            apiVersion = "2023-06-01",
            connectTimeoutMillis = 10_000,
            readTimeoutMillis = 30_000,
            retryDelayMillis = 1_000,
        )

    /**
     * Legado's web service, on this phone. 1122 is Legado's fixed port. Short timeouts: a slow
     * Legado must not hold up the card, which then answers without Book context. The read timeout
     * is longer because reading a local EPUB's chapter is the slow call.
     */
    val legado =
        LegadoSettings(
            baseUrl = "http://127.0.0.1:1122",
            connectTimeoutMillis = 1_000,
            readTimeoutMillis = 3_000,
        )

    override fun current(): GlossSettings =
        GlossSettings(
            defineModel = DEFINE_MODEL,
            defineMaxTokens = DEFINE_MAX_TOKENS,
            contextWordLimit = CONTEXT_WORD_LIMIT,
        )
}

/** How Gloss reaches Anthropic's Messages API. */
data class AnthropicSettings(
    val baseUrl: String,
    /** The `anthropic-version` header the requests and replies below are written for. */
    val apiVersion: String,
    val connectTimeoutMillis: Int,
    val readTimeoutMillis: Int,
    /** The wait before the one retry after a network error. */
    val retryDelayMillis: Long,
)

/** How Gloss reaches Legado's web service. */
data class LegadoSettings(
    val baseUrl: String,
    val connectTimeoutMillis: Int,
    val readTimeoutMillis: Int,
)
