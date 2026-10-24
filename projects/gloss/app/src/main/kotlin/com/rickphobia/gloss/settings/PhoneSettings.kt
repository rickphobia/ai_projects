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

    val anthropic =
        AnthropicSettings(
            baseUrl = "https://api.anthropic.com",
            apiVersion = "2023-06-01",
            connectTimeoutMillis = 10_000,
            readTimeoutMillis = 30_000,
            retryDelayMillis = 1_000,
        )

    override fun current(): GlossSettings =
        GlossSettings(defineModel = DEFINE_MODEL, defineMaxTokens = DEFINE_MAX_TOKENS)
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
