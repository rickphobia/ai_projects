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
import java.time.Clock

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
) {
    private val bookContext = BookContextFinder(legado)

    /**
     * Asks for the meaning of [selection], with its Book context when Legado has it, and returns
     * what the card shows. An answer is saved as a Lookup; a failure isn't, since there is nothing
     * to look back at.
     */
    suspend fun define(selection: Selection): DefineResult {
        val current = settings.current()
        val context = bookContext.find(selection, current.contextWordLimit)
        val found = (context as? BookContextResult.Found)?.context
        return when (val reply = ai.ask(DefinePrompt.forSelection(selection, found, current))) {
            is AiReply.Answer -> {
                val answer = reply.text.trim()
                if (answer.isEmpty()) {
                    DefineResult.Failed(AiFailure.AiError)
                } else {
                    lookups.save(Lookup(selection.text, answer, clock.instant()))
                    DefineResult.Answer(answer, context)
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
    /** The answer, and the Book context it used or why there was none. */
    data class Answer(
        val text: String,
        val context: BookContextResult,
    ) : DefineResult

    data class Failed(
        val failure: AiFailure,
    ) : DefineResult
}
