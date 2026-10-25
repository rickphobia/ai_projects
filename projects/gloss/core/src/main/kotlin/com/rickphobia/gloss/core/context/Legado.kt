package com.rickphobia.gloss.core.context

/**
 * The Legado port: what Gloss reads from Legado's web service. The app's adapter talks to it over
 * HTTP; tests use a fake. It never throws for an expected failure (the web service off, slow, or
 * refusing): those come back as [LegadoReply.Failed].
 */
interface Legado {
    /** Every book on Legado's bookshelf, in no particular order. */
    suspend fun bookshelf(): LegadoReply<List<ShelfBook>>

    /** The text of chapter [chapterIndex] of the book at [bookUrl], as Legado shows it. */
    suspend fun chapterText(
        bookUrl: String,
        chapterIndex: Int,
    ): LegadoReply<String>
}

/** A book on Legado's bookshelf, with where the owner is in it. */
data class ShelfBook(
    /** Legado's id for the book: a web address for an online book, a file address for a local one. */
    val bookUrl: String,
    val name: String,
    val author: String,
    val chapterIndex: Int,
    val chapterTitle: String,
    /** The reading position: about how many characters into the chapter the owner is. */
    val chapterPosition: Int,
    /** When the owner last read it, in epoch milliseconds (Legado's `durChapterTime`). */
    val lastReadAtMillis: Long,
)

sealed interface LegadoReply<out T> {
    data class Ok<T>(
        val value: T,
    ) : LegadoReply<T>

    data class Failed(
        val failure: LegadoFailure,
    ) : LegadoReply<Nothing>
}

/** Why Legado couldn't answer. */
enum class LegadoFailure {
    /** Nothing listens on Legado's port: the web service is off, or Legado isn't running. */
    Off,

    /** Legado didn't answer within the timeout. */
    Slow,

    /** Legado lost its permission to read a local book's file ("Permission Denial"). */
    NoFileAccess,

    /** Legado answered with an error, or with something Gloss can't read. */
    Error,
}
