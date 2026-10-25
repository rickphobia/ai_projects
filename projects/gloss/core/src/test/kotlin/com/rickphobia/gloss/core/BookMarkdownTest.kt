package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.bookpage.BookPages
import com.rickphobia.gloss.core.context.BookLocation
import com.rickphobia.gloss.core.context.BookPlace
import com.rickphobia.gloss.core.lookup.FollowUp
import com.rickphobia.gloss.core.lookup.Lookup
import com.rickphobia.gloss.core.lookup.LookupKind
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.core.note.Note
import com.rickphobia.gloss.core.note.SqlNoteStore
import com.rickphobia.gloss.core.storage.GlossDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class BookMarkdownTest {
    private val database =
        GlossDatabase(JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).also(GlossDatabase.Schema::create))
    private val lookups = SqlLookupStore(database)
    private val notes = SqlNoteStore(database)
    private val pages = BookPages(lookups, notes)
    private val start = Instant.parse("2026-10-20T09:00:00Z")
    private val bookUrl = "/storage/emulated/0/Books/crime.epub"

    private fun minutes(count: Long): Instant = start.plusSeconds(count * 60)

    private fun crime(
        chapterIndex: Int,
        title: String,
        position: Int,
    ) = BookLocation("Crime and Punishment", "Fyodor Dostoevsky", title, BookPlace(bookUrl, chapterIndex, position))

    @Test
    fun `a book's Markdown has its title and author, then each chapter's Notes and Lookups oldest first`() {
        runBlocking {
            // Made out of reading order: the later chapter first, and the newer Lookup sits earlier in chapter 1.
            notes.save(
                Note("Raskolnikov", "He never says his plan aloud.", minutes(1), crime(2, "Part I, Chapter 2", 10)),
            )
            val explain =
                lookups.save(
                    Lookup(
                        "He was hopelessly in debt to his landlady.",
                        "He owed her a lot of rent.",
                        minutes(2),
                        LookupKind.Explain,
                        book = crime(1, "Part I, Chapter 1", 400),
                    ),
                )
            lookups.addFollowUp(explain, FollowUp("Why does he hide?", "He is ashamed to face her."))
            notes.save(Note("in debt", "Money again.", minutes(4), crime(1, "Part I, Chapter 1", 400), explain))
            lookups.save(
                Lookup("garret", "A small room under the roof.", minutes(3), book = crime(1, "Part I, Chapter 1", 5)),
            )
        }
        val summary = runBlocking { pages.books() }.single()

        assertEquals(
            """
            # Crime and Punishment

            Fyodor Dostoevsky

            ## Part I, Chapter 1

            > He was hopelessly in debt to his landlady.

            He owed her a lot of rent.

            **Why does he hide?**

            He is ashamed to face her.

            **Note:** Money again.

            > garret

            A small room under the roof.

            ## Part I, Chapter 2

            > Raskolnikov

            **Note:** He never says his plan aloud.

            """.trimIndent(),
            runBlocking { pages.markdown(summary) },
        )
    }

    @Test
    fun `No book's Markdown has no author or chapters, and a Selection over lines stays one quote`() {
        runBlocking { notes.save(Note("first line\nsecond line", "Alone.", minutes(1))) }
        val summary = runBlocking { pages.books() }.single()

        assertEquals(
            """
            # No book

            > first line
            > second line

            **Note:** Alone.

            """.trimIndent(),
            runBlocking { pages.markdown(summary) },
        )
    }
}
