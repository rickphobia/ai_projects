package com.rickphobia.gloss.core.context

/** The part of a system prompt that gives the AI the Book context and holds it to the Spoiler line. */
object BookContextPrompt {
    /** Keeps answers behind the Spoiler line, even for a book the model knows. */
    val SPOILER_RULE =
        """
        The passage ends at the reader's current place in the book: they have read nothing after it.
        Never use or reveal anything from later in the book, even if you know the book well:
        no later events, twists, identities, relationships or fates, not even as a hint.
        """.trimIndent().replace('\n', ' ')

    /** [instructions], then the book, [task] for the marked Selection, the spoiler rule and the passage. */
    fun withBookContext(
        instructions: String,
        context: BookContext,
        task: String,
    ): String {
        val book = if (context.author.isEmpty()) context.book else "${context.book} by ${context.author}"
        val chapter = if (context.chapter.isEmpty()) "" else ", in the chapter \"${context.chapter}\""
        val marked = "${BookContext.SELECTION_START}like this${BookContext.SELECTION_END}"
        return """
            |$instructions
            |
            |They are reading $book$chapter. Below is the book's text up to their place, with the selection marked $marked in its last paragraph.
            |$task
            |
            |$SPOILER_RULE
            |
            |<passage>
            |${context.passage}
            |</passage>
            """.trimMargin()
    }
}
