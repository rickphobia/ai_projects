package com.rickphobia.gloss.core.define

import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.settings.GlossSettings

/** The prompt for a Define from the Selection alone, with no Book context. */
object DefinePrompt {
    val SYSTEM =
        """
        You help someone reading an English book understand a word, phrase or sentence they have selected.
        Give only its meaning as it is most likely used, in one or two short, plain lines.
        If the selection is a whole sentence, give what the sentence means, the same way.
        No preamble, no repeating the selection, no examples, no lists, no markdown.
        """.trimIndent().replace('\n', ' ')

    fun forSelection(
        selection: Selection,
        settings: GlossSettings,
    ): AiPrompt =
        AiPrompt(
            model = settings.defineModel,
            system = SYSTEM,
            userMessage = selection.text,
            maxTokens = settings.defineMaxTokens,
        )
}
