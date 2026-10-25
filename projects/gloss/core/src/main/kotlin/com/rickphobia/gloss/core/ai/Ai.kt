package com.rickphobia.gloss.core.ai

/**
 * The AI port: sends one prompt and returns the reply. The app's adapter talks to Anthropic; tests
 * use a fake. It never throws for an expected failure (no network, a rejected key): those come
 * back as [AiReply.Failed].
 */
fun interface Ai {
    suspend fun ask(prompt: AiPrompt): AiReply
}

/** One call to the AI: which model, the instructions ([system]) and the owner's turn. */
data class AiPrompt(
    val model: String,
    val system: String,
    val userMessage: String,
    val maxTokens: Int,
)

/** Tokens a call used, which is what it costs. */
data class TokenUsage(
    val inputTokens: Long,
    val outputTokens: Long,
)

sealed interface AiReply {
    data class Answer(
        val text: String,
        val usage: TokenUsage,
    ) : AiReply

    /** The call failed. [usage] is set when the model ran before it failed, so it still cost money. */
    data class Failed(
        val failure: AiFailure,
        val usage: TokenUsage? = null,
    ) : AiReply
}

/** Why a call to the AI failed, in the terms the card shows to the owner. */
enum class AiFailure {
    /** No key has been saved yet. */
    NoKey,

    /** Anthropic refused the key. */
    KeyRejected,

    /** The phone couldn't reach Anthropic, even after a retry. */
    NoInternet,

    /** Anthropic answered with an error, or with nothing usable. */
    AiError,
}
