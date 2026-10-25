package com.rickphobia.gloss.core.define

import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.context.BookContext
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

    /** Keeps answers behind the Spoiler line, even for a book the model knows. */
    val SPOILER_RULE =
        """
        The passage ends at the reader's current place in the book: they have read nothing after it.
        Never use or reveal anything from later in the book, even if you know the book well:
        no later events, twists, identities, relationships or fates, not even as a hint.
        """.trimIndent().replace('\n', ' ')

    fun forSelection(
        selection: Selection,
        context: BookContext?,
        settings: GlossSettings,
    ): AiPrompt =
        AiPrompt(
            model = settings.defineModel,
            system = if (context == null) SYSTEM else withBookContext(context),
            userMessage = selection.text,
            maxTokens = settings.defineMaxTokens,
        )

    private fun withBookContext(context: BookContext): String {
        val book = if (context.author.isEmpty()) context.book else "${context.book} by ${context.author}"
        val chapter = if (context.chapter.isEmpty()) "" else ", in the chapter \"${context.chapter}\""
        val marked = "${BookContext.SELECTION_START}like this${BookContext.SELECTION_END}"
        return """
            |$SYSTEM
            |
            |They are reading $book$chapter. Below is the book's text up to their place, with the selection marked $marked in its last paragraph.
            |Give the meaning it has there, including any reference or allusion the book makes with it.
            |
            |$SPOILER_RULE
            |
            |<passage>
            |${context.passage}
            |</passage>
            """.trimMargin()
    }
}
