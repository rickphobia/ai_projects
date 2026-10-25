package com.rickphobia.gloss.core

import com.rickphobia.gloss.core.ai.Ai
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.spending.ModelPrice
import com.rickphobia.gloss.core.spending.Spending
import java.time.LocalDate

/** The AI behind the Spending limit: every call that used tokens is counted, even one that then failed. */
internal class MeteredAi(
    private val ai: Ai,
    private val spending: Spending,
) {
    /** The day the limit resets when this month's spend has reached it, so no call may be made; else null. */
    suspend fun limitReachedUntil(limitMicros: Long): LocalDate? =
        spending.thisMonth(limitMicros).takeIf { it.limitReached }?.resetsOn

    suspend fun ask(
        prompt: AiPrompt,
        price: ModelPrice,
        limitMicros: Long,
    ): Metered {
        val reply = ai.ask(prompt)
        val usage =
            when (reply) {
                is AiReply.Answer -> reply.usage
                is AiReply.Failed -> reply.usage
            }
        if (usage != null) spending.record(usage, price)
        return when (reply) {
            is AiReply.Answer -> {
                val answer = reply.text.trim()
                if (answer.isEmpty()) {
                    Metered.Failed(AiFailure.AiError)
                } else {
                    Metered.Answer(answer, spending.thisMonth(limitMicros).nearLimit)
                }
            }

            is AiReply.Failed -> {
                Metered.Failed(reply.failure)
            }
        }
    }
}

internal sealed interface Metered {
    /** The answer without the space around it; [nearLimit] once this month's spend is past 80%. */
    data class Answer(
        val text: String,
        val nearLimit: Boolean,
    ) : Metered

    data class Failed(
        val failure: AiFailure,
    ) : Metered
}
