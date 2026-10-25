package com.rickphobia.gloss.core.define

import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.ChatMessage
import com.rickphobia.gloss.core.context.BookContext
import com.rickphobia.gloss.core.context.BookContextPrompt
import com.rickphobia.gloss.core.settings.GlossSettings

/** The prompt for a Define: the Selection, with its Book context when there is one. */
object DefinePrompt {
    val SYSTEM =
        """
        You help someone reading an English book understand a word, phrase or sentence they have selected.
        Give only its meaning as it is most likely used, in one or two short, plain lines.
        If the selection is a whole sentence, give what the sentence means, the same way.
        No preamble, no repeating the selection, no examples, no lists, no markdown.
        """.trimIndent().replace('\n', ' ')

    private const val TASK =
        "Give the meaning it has there, including any reference or allusion the book makes with it."

    fun forSelection(
        selection: Selection,
        context: BookContext?,
        settings: GlossSettings,
    ): AiPrompt =
        AiPrompt(
            model = settings.defineModel,
            system = if (context == null) SYSTEM else BookContextPrompt.withBookContext(SYSTEM, context, TASK),
            messages = listOf(ChatMessage(ChatMessage.Speaker.Owner, selection.text)),
            maxTokens = settings.defineMaxTokens,
        )
}
