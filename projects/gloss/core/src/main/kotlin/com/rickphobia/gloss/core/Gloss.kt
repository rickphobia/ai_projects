package com.rickphobia.gloss.core

import com.rickphobia.gloss.core.ai.Ai
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.bookpage.BookPages
import com.rickphobia.gloss.core.context.BookContextFinder
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.context.BookLocation
import com.rickphobia.gloss.core.context.Legado
import com.rickphobia.gloss.core.define.DefinePrompt
import com.rickphobia.gloss.core.explain.ExplainChat
import com.rickphobia.gloss.core.explain.ExplainPrompt
import com.rickphobia.gloss.core.lookup.FollowUp
import com.rickphobia.gloss.core.lookup.Lookup
import com.rickphobia.gloss.core.lookup.LookupKind
import com.rickphobia.gloss.core.lookup.LookupStore
import com.rickphobia.gloss.core.note.Note
import com.rickphobia.gloss.core.note.NoteStore
import com.rickphobia.gloss.core.settings.GlossSettings
import com.rickphobia.gloss.core.settings.SettingsSource
import com.rickphobia.gloss.core.spending.MonthSpend
import com.rickphobia.gloss.core.spending.SpendStore
import com.rickphobia.gloss.core.spending.Spending
import java.time.Clock
import java.time.LocalDate

/**
 * The Gloss core: the one entry point the card and screens use. It talks to the outside world
 * only through its ports, so tests drive it with fakes.
 *
 * Every call checks the Spending limit first and makes no AI call at or over it. Every call that
 * used tokens counts toward the limit, even one that then failed. An answer is saved; a failure
 * isn't, since there is nothing to look back at. A Note never reaches the AI, so it costs nothing.
 */
class Gloss(
    ai: Ai,
    legado: Legado,
    storage: GlossStorage,
    private val clock: Clock,
    private val settings: SettingsSource,
) {
    private val lookups = storage.lookups
    private val notes = storage.notes
    private val bookContext = BookContextFinder(legado)
    private val spending = Spending(storage.spends, clock)
    private val metered = MeteredAi(ai, spending)

    /** The Books screen, Book pages and Recent, and tidying them up. */
    val bookPages = BookPages(lookups, notes)

    /** This calendar month's spend against the Spending limit, for Settings. */
    suspend fun monthSpend(): MonthSpend = spending.thisMonth(settings.current().spendingLimitMicros)

    /** Asks for the meaning of [selection], with its Book context when Legado has it. */
    suspend fun define(selection: Selection): DefineResult {
        val current = settings.current()
        metered.limitReachedUntil(current.spendingLimitMicros)?.let { return DefineResult.LimitReached(it) }
        val context = bookContext.find(selection, current.contextWordLimit)
        val found = (context as? BookContextResult.Found)?.bookContext
        val prompt = DefinePrompt.forSelection(selection, found, current)
        return when (val reply = metered.ask(prompt, current.definePrice, current.spendingLimitMicros)) {
            is Metered.Answer -> {
                val id = lookups.save(Lookup(selection.text, reply.text, clock.instant(), book = locationOf(context)))
                DefineResult.Answer(reply.text, context, id, reply.nearLimit)
            }

            is Metered.Failed -> {
                DefineResult.Failed(reply.failure)
            }
        }
    }

    /** Starts an Explain chat on [selection], with its Book context when Legado has it. */
    suspend fun explain(selection: Selection): ExplainResult {
        val current = settings.current()
        metered.limitReachedUntil(current.spendingLimitMicros)?.let { return ExplainResult.LimitReached(it) }
        return startChat(selection, bookContext.find(selection, current.contextWordLimit), current)
    }

    /**
     * "Explain more" on a Define card: an Explain chat on the Define's [selection], with the Book
     * [context] that Define used, so Legado isn't asked again.
     */
    suspend fun explainMore(
        selection: Selection,
        context: BookContextResult,
    ): ExplainResult {
        val current = settings.current()
        metered.limitReachedUntil(current.spendingLimitMicros)?.let { return ExplainResult.LimitReached(it) }
        return startChat(selection, context, current)
    }

    /** Asks [question] in [chat], with the chat's Book context and Spoiler line, and adds it to its Lookup. */
    suspend fun followUp(
        chat: ExplainChat,
        question: String,
    ): ExplainResult {
        val asked = question.trim()
        require(asked.isNotEmpty()) { "A follow-up needs a question" }
        val current = settings.current()
        metered.limitReachedUntil(current.spendingLimitMicros)?.let { return ExplainResult.LimitReached(it) }
        val prompt = ExplainPrompt.followUp(chat, asked, current)
        return when (val reply = metered.ask(prompt, current.explainPrice, current.spendingLimitMicros)) {
            is Metered.Answer -> {
                val followUp = FollowUp(asked, reply.text)
                lookups.addFollowUp(chat.lookupId, followUp)
                ExplainResult.Answer(chat.copy(followUps = chat.followUps + followUp), reply.nearLimit)
            }

            is Metered.Failed -> {
                ExplainResult.Failed(reply.failure)
            }
        }
    }

    /** The Book context for a Note from the menu: Legado only, no AI. */
    suspend fun noteContext(selection: Selection): BookContextResult =
        bookContext.find(selection, settings.current().contextWordLimit)

    /**
     * Saves the owner's [text] about [selection] with the book and chapter in [context], or under
     * "No book" when there is none. [lookupId] attaches it to the Lookup whose card it was written on.
     */
    suspend fun note(
        selection: Selection,
        text: String,
        context: BookContextResult,
        lookupId: Long? = null,
    ): Note {
        val written = text.trim()
        require(written.isNotEmpty()) { "A Note needs some text" }
        val note = Note(selection.text, written, clock.instant(), locationOf(context), lookupId)
        notes.save(note)
        return note
    }

    private suspend fun startChat(
        selection: Selection,
        context: BookContextResult,
        current: GlossSettings,
    ): ExplainResult {
        val prompt = ExplainPrompt.first(selection, context, current)
        return when (val reply = metered.ask(prompt, current.explainPrice, current.spendingLimitMicros)) {
            is Metered.Answer -> {
                val lookup =
                    Lookup(selection.text, reply.text, clock.instant(), LookupKind.Explain, book = locationOf(context))
                val id = lookups.save(lookup)
                ExplainResult.Answer(ExplainChat(id, selection, context, reply.text), reply.nearLimit)
            }

            is Metered.Failed -> {
                ExplainResult.Failed(reply.failure)
            }
        }
    }
}

/** Where a Lookup or Note made with [context] is kept: its book and chapter, or "No book". */
private fun locationOf(context: BookContextResult): BookLocation? =
    (context as? BookContextResult.Found)?.let { BookLocation.of(it.bookContext) }

/** The storage ports: where Lookups, Notes and the monthly spend are kept. */
data class GlossStorage(
    val lookups: LookupStore,
    val spends: SpendStore,
    val notes: NoteStore,
)

/** What the card shows for a Define. */
sealed interface DefineResult {
    /**
     * The answer, and the Book context it used or why there was none. [nearLimit] is set once this
     * month's spend is past 80% of the Spending limit, for the card's warning line.
     */
    data class Answer(
        val text: String,
        val context: BookContextResult,
        /** The saved Lookup, for attaching a Note to it. */
        val lookupId: Long,
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

/** What the card shows for a turn of an Explain chat. */
sealed interface ExplainResult {
    /** The chat with the new answer at its end; [nearLimit] as in [DefineResult.Answer]. */
    data class Answer(
        val chat: ExplainChat,
        val nearLimit: Boolean = false,
    ) : ExplainResult

    /** The turn failed; the chat is as it was before it. */
    data class Failed(
        val failure: AiFailure,
    ) : ExplainResult

    /** This month's spend has reached the Spending limit, so no call was made until [resetsOn]. */
    data class LimitReached(
        val resetsOn: LocalDate,
    ) : ExplainResult
}
