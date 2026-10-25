package com.rickphobia.gloss.core.context

/**
 * A [BookLocation] as the lookup and note tables keep it: six nullable columns, all null for
 * "No book".
 */
internal object BookLocationColumns {
    fun read(
        book: String?,
        author: String?,
        chapter: String?,
        place: BookPlace?,
    ): BookLocation? =
        if (book != null && place != null) BookLocation(book, author.orEmpty(), chapter.orEmpty(), place) else null

    fun place(
        bookUrl: String?,
        chapterIndex: Long?,
        position: Long?,
    ): BookPlace? = bookUrl?.let { BookPlace(it, chapterIndex?.toInt() ?: 0, position?.toInt() ?: 0) }
}
