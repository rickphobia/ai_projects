package com.rickphobia.gloss.core.bookpage

/**
 * A Book page as one Markdown file, for keeping in Drive, Obsidian or email: the title and author,
 * then each chapter's Notes and Lookups oldest first, each Selection as a quote.
 */
internal object BookMarkdown {
    private const val NO_BOOK = "No book"

    fun of(
        book: BookSummary,
        chapters: List<ChapterSection>,
    ): String {
        val blocks = mutableListOf("# ${book.book ?: NO_BOOK}")
        book.author?.takeIf(String::isNotBlank)?.let { blocks += it }
        chapters.forEach { section ->
            section.chapter?.takeIf(String::isNotBlank)?.let { blocks += "## $it" }
            section.entries.sortedWith(compareBy({ it.at }, { it.id })).forEach { blocks += entryBlocks(it) }
        }
        return blocks.joinToString(separator = "\n\n", postfix = "\n")
    }

    private fun entryBlocks(entry: Entry): List<String> =
        when (entry) {
            is LookupEntry -> {
                val lookup = entry.lookup
                listOf(quote(lookup.selection), lookup.answer) +
                    lookup.followUps.flatMap { listOf("**${it.question.trim()}**", it.answer) } +
                    entry.notes.map { note(it) }
            }

            is NoteEntry -> {
                listOf(quote(entry.note.selection), note(entry))
            }
        }

    private fun quote(selection: String) = selection.trim().lines().joinToString("\n") { "> $it".trimEnd() }

    private fun note(entry: NoteEntry) = "**Note:** ${entry.note.text}"
}
