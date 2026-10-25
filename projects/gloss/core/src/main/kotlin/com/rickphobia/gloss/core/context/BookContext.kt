package com.rickphobia.gloss.core.context

import com.rickphobia.gloss.core.Selection

/**
 * Where a Selection came from: the book, its author, the chapter, and the chapter's text up to
 * the owner's place. [passage] is the text before the Selection, the Selection itself marked
 * [SELECTION_START]…[SELECTION_END] as the chapter writes it, and the rest of its paragraph; nothing
 * past that paragraph, so nothing past the Spoiler line, is ever in it.
 */
data class BookContext(
    val book: String,
    val author: String,
    val chapter: String,
    val passage: String,
    /** Where the Selection is in Legado, for Book pages. */
    val place: BookPlace,
) {
    companion object {
        const val SELECTION_START = "⟪"
        const val SELECTION_END = "⟫"
    }
}

/**
 * A place in a Legado book: the book's URL (how books are told apart), the chapter index, and how
 * many characters into the chapter the Selection starts. Book pages order by chapter, then position.
 */
data class BookPlace(
    val bookUrl: String,
    val chapterIndex: Int,
    val position: Int,
)

/**
 * The book and chapter a Lookup or Note was made in, and where: its Book context without the
 * passage. Saved with it, so its Book page is built without asking Legado again.
 */
data class BookLocation(
    val book: String,
    val author: String,
    val chapter: String,
    val place: BookPlace,
) {
    companion object {
        fun of(context: BookContext) = BookLocation(context.book, context.author, context.chapter, context.place)
    }
}

/** The Book context a Lookup used, or why it had none. */
sealed interface BookContextResult {
    data class Found(
        val bookContext: BookContext,
    ) : BookContextResult

    data class Missing(
        val reason: NoBookContextReason,
    ) : BookContextResult
}

/** Why a Lookup has no Book context, in the terms the card shows. */
enum class NoBookContextReason {
    LegadoOff,
    LegadoSlow,
    LegadoCantOpenBook,
    LegadoError,

    /** Legado's bookshelf is empty, or no book on it has been opened. */
    NoBookRead,

    /** The Selection isn't in the chapter being read, such as text selected in another app. */
    NotInChapter,
}

/**
 * The Book context rule: the book read most recently in Legado, and the Selection found in its
 * current chapter. Up to [wordLimit] words before the Selection are kept, plus the rest of its
 * paragraph.
 */
class BookContextFinder(
    private val legado: Legado,
) {
    suspend fun find(
        selection: Selection,
        wordLimit: Int,
    ): BookContextResult =
        when (val shelf = legado.bookshelf()) {
            is LegadoReply.Failed -> {
                missing(shelf.failure)
            }

            is LegadoReply.Ok -> {
                shelf.value
                    .filter { it.lastReadAtMillis > 0 }
                    .maxByOrNull { it.lastReadAtMillis }
                    ?.let { book -> inChapter(book, selection, wordLimit) }
                    ?: BookContextResult.Missing(NoBookContextReason.NoBookRead)
            }
        }

    private suspend fun inChapter(
        book: ShelfBook,
        selection: Selection,
        wordLimit: Int,
    ): BookContextResult =
        when (val chapter = legado.chapterText(book.bookUrl, book.chapterIndex)) {
            is LegadoReply.Failed -> {
                missing(chapter.failure)
            }

            is LegadoReply.Ok -> {
                ChapterMatch
                    .find(chapter.value, selection.text, book.chapterPosition)
                    ?.let { match -> BookContextResult.Found(contextAround(book, chapter.value, match, wordLimit)) }
                    ?: BookContextResult.Missing(NoBookContextReason.NotInChapter)
            }
        }

    private fun contextAround(
        book: ShelfBook,
        chapter: String,
        match: IntRange,
        wordLimit: Int,
    ): BookContext {
        val paragraphEnd = chapter.indexOfAny(PARAGRAPH_BREAKS, match.last + 1).takeIf { it >= 0 } ?: chapter.length
        val start = startOfLastWords(chapter, match.first, wordLimit)
        val marked =
            chapter.substring(start, match.first) + BookContext.SELECTION_START +
                chapter.substring(match.first, match.last + 1) + BookContext.SELECTION_END +
                chapter.substring(match.last + 1, paragraphEnd)
        // One paragraph per line, without Legado's indents or blank lines: the AI is paid by the token.
        val passage =
            marked
                .split(PARAGRAPH_BREAK)
                .map(String::trim)
                .filter(String::isNotEmpty)
                .joinToString("\n")
        return BookContext(
            book = book.name.trim(),
            author = book.author.trim(),
            chapter = book.chapterTitle.trim(),
            passage = if (start > 0) "… $passage" else passage,
            place = BookPlace(book.bookUrl, book.chapterIndex, match.first),
        )
    }

    /** Where the last [wordLimit] words of `text[0, end)` start. */
    private fun startOfLastWords(
        text: String,
        end: Int,
        wordLimit: Int,
    ): Int {
        var index = end
        var words = 0
        while (index > 0 && words < wordLimit) {
            while (index > 0 && text[index - 1].isWhitespace()) index--
            if (index == 0) break
            while (index > 0 && !text[index - 1].isWhitespace()) index--
            words++
        }
        return index
    }

    private companion object {
        /** Line feed, carriage return, and Unicode's line and paragraph separators. */
        val PARAGRAPH_BREAKS = charArrayOf('\n', '\r', ' ', ' ')
        val PARAGRAPH_BREAK = Regex("[\n\r  ]")
    }

    private fun missing(failure: LegadoFailure): BookContextResult.Missing =
        BookContextResult.Missing(
            when (failure) {
                LegadoFailure.Off -> NoBookContextReason.LegadoOff
                LegadoFailure.Slow -> NoBookContextReason.LegadoSlow
                LegadoFailure.NoFileAccess -> NoBookContextReason.LegadoCantOpenBook
                LegadoFailure.Error -> NoBookContextReason.LegadoError
            },
        )
}
