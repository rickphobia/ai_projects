package com.rickphobia.gloss.core.explain

import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.ChatMessage
import com.rickphobia.gloss.core.ai.ChatMessage.Speaker
import com.rickphobia.gloss.core.context.BookContext
import com.rickphobia.gloss.core.context.BookContextPrompt
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.lookup.FollowUp
import com.rickphobia.gloss.core.settings.GlossSettings

/**
 * The prompts for an Explain chat. Every turn sends the same instructions and Book context, marked
 * for caching, so a follow-up keeps the context and the Spoiler line and pays little for them again.
 */
object ExplainPrompt {
    val SYSTEM =
        """
        You help someone reading an English book understand a sentence, passage or word they have selected.
        Explain what it means in one short paragraph of plain, simple words, as you would to a curious child (ELI5),
        including any idiom, irony, slang or reference in it.
        If the selection is a single word, explain what it means here, the same short, simple way.
        The reader may then ask follow-up questions about it: answer each briefly, in a few plain sentences.
        No preamble, no repeating the selection, no lists, no headings, no markdown.
        """.trimIndent().replace('\n', ' ')

    private const val TASK =
        "Explain what it means there, including any reference or allusion the book makes with it."

    /** The first turn: the Selection alone. */
    fun first(
        selection: Selection,
        context: BookContextResult,
        settings: GlossSettings,
    ): AiPrompt = prompt(context, listOf(ChatMessage(Speaker.Owner, selection.text)), settings)

    /** A follow-up [question] on [chat]: the whole chat so far, then the question. */
    fun followUp(
        chat: ExplainChat,
        question: String,
        settings: GlossSettings,
    ): AiPrompt {
        val history =
            listOf(
                ChatMessage(Speaker.Owner, chat.selection.text),
                ChatMessage(Speaker.Ai, chat.explanation),
            ) +
                chat.followUps.flatMap {
                    listOf(ChatMessage(Speaker.Owner, it.question), ChatMessage(Speaker.Ai, it.answer))
                }
        return prompt(chat.context, history + ChatMessage(Speaker.Owner, question), settings)
    }

    private fun prompt(
        context: BookContextResult,
        messages: List<ChatMessage>,
        settings: GlossSettings,
    ): AiPrompt =
        AiPrompt(
            model = settings.explainModel,
            system = system((context as? BookContextResult.Found)?.bookContext),
            messages = messages,
            maxTokens = settings.explainMaxTokens,
            cacheSystem = true,
            effort = settings.explainEffort,
        )

    private fun system(context: BookContext?): String =
        if (context == null) SYSTEM else BookContextPrompt.withBookContext(SYSTEM, context, TASK)
}
