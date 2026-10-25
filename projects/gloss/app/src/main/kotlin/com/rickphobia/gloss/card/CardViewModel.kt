package com.rickphobia.gloss.card

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rickphobia.gloss.core.DefineResult
import com.rickphobia.gloss.core.ExplainResult
import com.rickphobia.gloss.core.Gloss
import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.explain.ExplainChat
import com.rickphobia.gloss.logging.RollingLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Which selection-menu entry opened the card. */
enum class CardKind { Define, Explain }

/** An Explain chat as the card shows it. */
data class ExplainCardState(
    /** Null until the first answer arrives. */
    val chat: ExplainChat? = null,
    /** The follow-up being answered, or the one that failed and Retry sends again. */
    val asking: String? = null,
    val waiting: Boolean = true,
    /** Why the last turn got no answer: [ExplainResult.Failed] or [ExplainResult.LimitReached]. */
    val problem: ExplainResult? = null,
    val nearLimit: Boolean = false,
)

/**
 * Runs the Define or the Explain chat for one card. It outlives a screen rotation, so turning the
 * phone doesn't pay for a second call.
 */
class CardViewModel(
    private val gloss: Gloss,
    val selection: Selection,
    startWith: CardKind,
    private val log: RollingLog,
) : ViewModel() {
    /** The Define's answer or failure, or null while the AI is answering. Unused on an Explain card. */
    var define: DefineResult? by mutableStateOf(null)
        private set

    /** The Explain chat, once the card is one: from the Explain entry, or after Explain more. */
    var explain: ExplainCardState? by mutableStateOf(null)
        private set

    /** The follow-up question being typed. */
    var question: String by mutableStateOf("")
        private set

    /** The last Explain turn, for Retry: its question (null for the first turn) and the call. */
    private var lastTurn: Pair<String?, suspend () -> ExplainResult>? = null

    init {
        when (startWith) {
            CardKind.Define -> define()
            CardKind.Explain -> runTurn(null) { gloss.explain(selection) }
        }
    }

    fun retry() {
        val chat = explain
        when {
            chat != null -> if (chat.problem != null) lastTurn?.let { (asked, turn) -> runTurn(asked, turn) }
            define != null -> define()
        }
    }

    /** Turns this Define card into an Explain chat on the same Selection and Book context. */
    fun explainMore() {
        val answer = define as? DefineResult.Answer ?: return
        if (explain != null) return
        runTurn(null) { gloss.explainMore(selection, answer.context) }
    }

    fun editQuestion(text: String) {
        question = text
    }

    /** Sends the typed question as a follow-up, once the chat has its first answer and isn't busy. */
    fun ask() {
        val chat = explain?.takeUnless { it.waiting }?.chat
        val asked = question.trim()
        if (chat != null && asked.isNotEmpty()) {
            question = ""
            runTurn(asked) { gloss.followUp(chat, asked) }
        }
    }

    private fun define() {
        define = null
        viewModelScope.launch {
            val defined = withContext(Dispatchers.IO) { gloss.define(selection) }
            when (defined) {
                is DefineResult.Answer -> {
                    logBookContext(defined.context)
                }

                is DefineResult.LimitReached -> {
                    log.info(
                        "define: spending limit reached, resets_on=${defined.resetsOn}",
                    )
                }

                is DefineResult.Failed -> {
                    Unit
                }
            }
            define = defined
        }
    }

    private fun runTurn(
        asked: String?,
        turn: suspend () -> ExplainResult,
    ) {
        lastTurn = asked to turn
        explain = (explain ?: ExplainCardState()).copy(asking = asked, waiting = true, problem = null)
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) { turn() }
            val before = explain ?: ExplainCardState()
            explain =
                when (result) {
                    is ExplainResult.Answer -> {
                        if (before.chat == null) logBookContext(result.chat.context)
                        log.info("explain: answered, follow_ups=${result.chat.followUps.size}")
                        before.copy(chat = result.chat, asking = null, waiting = false, nearLimit = result.nearLimit)
                    }

                    is ExplainResult.LimitReached -> {
                        log.info("explain: spending limit reached, resets_on=${result.resetsOn}")
                        before.copy(waiting = false, problem = result)
                    }

                    is ExplainResult.Failed -> {
                        before.copy(waiting = false, problem = result)
                    }
                }
        }
    }

    /** Whether the answer had Book context, and why not: never the book, the passage or the Selection. */
    private fun logBookContext(context: BookContextResult) {
        when (context) {
            is BookContextResult.Found -> {
                log.info(
                    "book context: found, passage_chars=${context.bookContext.passage.length}",
                )
            }

            is BookContextResult.Missing -> {
                log.info("book context: none, reason=${context.reason}")
            }
        }
    }
}
