package com.rickphobia.gloss.core

import com.rickphobia.gloss.core.ai.Ai
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.context.BookContextFinder
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.context.Legado
import com.rickphobia.gloss.core.define.DefinePrompt
import com.rickphobia.gloss.core.lookup.Lookup
import com.rickphobia.gloss.core.lookup.LookupStore
import com.rickphobia.gloss.core.settings.SettingsSource
import com.rickphobia.gloss.core.spending.MonthSpend
import com.rickphobia.gloss.core.spending.SpendStore
import com.rickphobia.gloss.core.spending.Spending
import java.time.Clock
import java.time.LocalDate

/**
 * The Gloss core: the one entry point the card and screens use. It talks to the outside world
 * only through its ports, so tests drive it with fakes.
 */
class Gloss(
    private val ai: Ai,
    legado: Legado,
    private val lookups: LookupStore,
    private val clock: Clock,
    private val settings: SettingsSource,
    spends: SpendStore,
) {
    private val bookContext = BookContextFinder(legado)
    private val spending = Spending(spends, clock)

    /** This calendar month's spend against the Spending limit, for Settings. */
    suspend fun monthSpend(): MonthSpend = spending.thisMonth(settings.current().spendingLimitMicros)

    /**
     * Asks for the meaning of [selection], with its Book context when Legado has it, and returns
     * what the card shows. An answer is saved as a Lookup; a failure isn't, since there is nothing
     * to look back at. At or over the Spending limit no call is made. Every call that used tokens
     * counts toward the limit, even one that then failed.
     */
    suspend fun define(selection: Selection): DefineResult {
        val current = settings.current()
        val before = spending.thisMonth(current.spendingLimitMicros)
        if (before.limitReached) return DefineResult.LimitReached(before.resetsOn)
        val context = bookContext.find(selection, current.contextWordLimit)
        val found = (context as? BookContextResult.Found)?.bookContext
        val reply = ai.ask(DefinePrompt.forSelection(selection, found, current))
        val usage =
            when (reply) {
                is AiReply.Answer -> reply.usage
                is AiReply.Failed -> reply.usage
            }
        if (usage != null) spending.record(usage, current.definePrice)
        return when (reply) {
            is AiReply.Answer -> {
                val answer = reply.text.trim()
                if (answer.isEmpty()) {
                    DefineResult.Failed(AiFailure.AiError)
                } else {
                    lookups.save(Lookup(selection.text, answer, clock.instant()))
                    val nearLimit = spending.thisMonth(current.spendingLimitMicros).nearLimit
                    DefineResult.Answer(answer, context, nearLimit)
                }
            }

            is AiReply.Failed -> {
                DefineResult.Failed(reply.failure)
            }
        }
    }
}

/** What the card shows for a Define. */
sealed interface DefineResult {
    /**
     * The answer, and the Book context it used or why there was none. [nearLimit] is set once this
     * month's spend is past 80% of the Spending limit, for the card's warning line.
     */
    data class Answer(
        val text: String,
        val context: BookContextResult,
        val nearLimit: Boolean = false,
    ) : DefineResult

    data class Failed(
        val failure: AiFailure,
    ) : DefineResult

    /** This month's spend has reached the Spending limit, so no call was made until [resetsOn]. */
    data class LimitReached(
        val resetsOn: LocalDate,
    ) : DefineResult
}
