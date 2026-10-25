package com.rickphobia.gloss.settings

import com.rickphobia.gloss.core.settings.GlossSettings
import com.rickphobia.gloss.core.settings.SettingsSource
import com.rickphobia.gloss.core.spending.ModelPrice

/**
 * The settings module: every model name, address and timeout Gloss uses, with its defaults built
 * in. Only the Spending limit can be changed on the phone ([SpendingLimitStore]).
 */
object PhoneSettings {
    const val DEFINE_MODEL = "claude-haiku-5-5"

    /**
     * Claude Haiku 5.5's price for prompts up to 100K tokens, which a Define always is. Cache writes
     * are 1.25× input and reads 0.1×; Define doesn't cache, but the price is complete.
     */
    val definePrice =
        ModelPrice(
            inputMicrosPerMillion = 100_000,
            outputMicrosPerMillion = 500_000,
            cacheWriteMicrosPerMillion = 125_000,
            cacheReadMicrosPerMillion = 10_000,
        )

    /** $10 a month until the owner changes it in Settings. */
    const val DEFAULT_SPENDING_LIMIT_MICROS = 10_000_000L
    const val DEFINE_MAX_TOKENS = 150

    const val EXPLAIN_MODEL = "claude-sonnet-5-5"

    /** Claude Sonnet 5.5: $2 / $10 per million tokens, cache writes (5 minutes) $2.50, cache reads $0.20. */
    val explainPrice =
        ModelPrice(
            inputMicrosPerMillion = 2_000_000,
            outputMicrosPerMillion = 10_000_000,
            cacheWriteMicrosPerMillion = 2_500_000,
            cacheReadMicrosPerMillion = 200_000,
        )

    /** A short paragraph is about 150 tokens; the rest is room for the model's thinking first. */
    const val EXPLAIN_MAX_TOKENS = 1_024

    /** Low effort: a short, simple explanation needs little thinking, and answers sooner and cheaper. */
    const val EXPLAIN_EFFORT = "low"

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
     * Legado must not hold up the card for long, which then answers without Book context. A Define
     * makes two calls (bookshelf, then chapter), so the worst case is about twice these. Connecting
     * on the same phone is instant or refused; reading a local EPUB's chapter is the slow part.
     */
    val legado =
        LegadoSettings(
            baseUrl = "http://127.0.0.1:1122",
            connectTimeoutMillis = 500,
            readTimeoutMillis = 2_000,
        )
}

/** The settings the core reads on every call: the built-in ones, and the limit the owner set. */
class PhoneSettingsSource(
    private val limits: SpendingLimitStore,
) : SettingsSource {
    override fun current(): GlossSettings =
        GlossSettings(
            defineModel = PhoneSettings.DEFINE_MODEL,
            definePrice = PhoneSettings.definePrice,
            defineMaxTokens = PhoneSettings.DEFINE_MAX_TOKENS,
            explainModel = PhoneSettings.EXPLAIN_MODEL,
            explainPrice = PhoneSettings.explainPrice,
            explainMaxTokens = PhoneSettings.EXPLAIN_MAX_TOKENS,
            explainEffort = PhoneSettings.EXPLAIN_EFFORT,
            contextWordLimit = PhoneSettings.CONTEXT_WORD_LIMIT,
            spendingLimitMicros = limits.limitMicros(),
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
