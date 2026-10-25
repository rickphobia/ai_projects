package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.bookpage.BookSummary
import com.rickphobia.gloss.core.bookpage.LookupEntry
import com.rickphobia.gloss.core.bookpage.NoteEntry
import com.rickphobia.gloss.core.context.BookLocation
import com.rickphobia.gloss.core.context.BookPlace
import com.rickphobia.gloss.core.lookup.FollowUp
import com.rickphobia.gloss.core.lookup.Lookup
import com.rickphobia.gloss.core.lookup.LookupKind
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.core.note.Note
import com.rickphobia.gloss.core.note.SqlNoteStore
import com.rickphobia.gloss.core.spending.SqlSpendStore
import com.rickphobia.gloss.core.storage.GlossDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class BookPagesTest {
    private val database =
        GlossDatabase(JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).also(GlossDatabase.Schema::create))
    private val lookups = SqlLookupStore(database)
    private val notes = SqlNoteStore(database)
    private val start = Instant.parse("2026-10-20T09:00:00Z")
    private val book = shelfBook()

    private fun gloss(legado: FakeLegado = FakeLegado.off) =
        Gloss(
            FakeAi(),
            legado,
            GlossStorage(lookups, SqlSpendStore(database), notes),
            Clock.fixed(start, ZoneOffset.UTC),
        ) { testSettings }

    private val pages = gloss().bookPages

    private fun minutes(count: Long): Instant = start.plusSeconds(count * 60)

    private fun crime(
        chapterIndex: Int,
        position: Int,
    ) = BookLocation(
        "Crime and Punishment",
        "Fyodor Dostoevsky",
        "Chapter $chapterIndex",
        BookPlace(book.bookUrl, chapterIndex, position),
    )

    private val idiotUrl = "/storage/emulated/0/Books/the-idiot.epub"
    private val idiot = BookLocation("The Idiot", "Fyodor Dostoevsky", "Part 1", BookPlace(idiotUrl, 1, 0))

    private fun lookup(
        selection: String,
        at: Instant,
        book: BookLocation? = null,
    ): Long = runBlocking { lookups.save(Lookup(selection, "Answer to $selection.", at, book = book)) }

    private fun note(
        text: String,
        at: Instant,
        book: BookLocation? = null,
        lookupId: Long? = null,
    ): Long = runBlocking { notes.save(Note("selection", text, at, book, lookupId)) }

    private fun <T> run(block: suspend () -> T): T = runBlocking { block() }

    @Test
    fun `Books lists every book, and No book, by its newest Lookup or Note`() {
        lookup("garret", minutes(1), crime(3, 0))
        lookup("prince", minutes(2), idiot)
        note("No book thought.", minutes(3))
        val onGarret = lookup("lodger", minutes(4), crime(3, 50))
        note("Later note on a Lookup.", minutes(9), crime(3, 50), onGarret)

        assertEquals(
            listOf(
                BookSummary(book.bookUrl, "Crime and Punishment", "Fyodor Dostoevsky", minutes(9)),
                BookSummary(null, null, null, minutes(3)),
                BookSummary(idiotUrl, "The Idiot", "Fyodor Dostoevsky", minutes(2)),
            ),
            run { pages.books() },
        )
    }

    @Test
    fun `nothing saved means no books, not an empty No book`() {
        assertEquals(emptyList<BookSummary>(), run { pages.books() })
    }

    @Test
    fun `a Book page is in reading order, by chapter then position, whatever order things were made in`() {
        val late = lookup("axe", minutes(1), crime(5, 10))
        val laterInChapter = note("Second in chapter 3.", minutes(2), crime(3, 900))
        val early = lookup("garret", minutes(3), crime(3, 20))
        val noteOnEarly = note("On garret.", minutes(4), crime(3, 20), early)
        lookup("prince", minutes(5), idiot)

        val page = run { pages.page(book.bookUrl) }

        assertEquals(listOf(3, 5), page.map { it.chapterIndex })
        assertEquals(listOf("Chapter 3", "Chapter 5"), page.map { it.chapter })
        assertEquals(listOf(early, laterInChapter), page[0].entries.map { it.id })
        assertEquals(listOf(noteOnEarly), (page[0].entries[0] as LookupEntry).notes.map { it.id })
        assertEquals(listOf(late), page[1].entries.map { it.id })
    }

    @Test
    fun `the No book page holds what had no Book context, oldest first`() {
        val first = note("First.", minutes(1))
        lookup("garret", minutes(2), crime(3, 0))
        val second = lookup("axe", minutes(3))

        val page = run { pages.page(null) }.single()

        assertEquals(null to null, page.chapterIndex to page.chapter)
        assertEquals(listOf(first, second), page.entries.map { it.id })
    }

    @Test
    fun `Recent lists the newest Lookups and Notes across books, each on its own`() {
        val garret = lookup("garret", minutes(1), crime(3, 0))
        val prince = lookup("prince", minutes(2), idiot)
        val onGarret = note("On garret.", minutes(3), crime(3, 0), garret)
        val alone = note("Alone.", minutes(4))

        val recent = run { pages.recent(limit = 3) }

        assertEquals(listOf(alone, onGarret, prince), recent.map { it.id })
        assertEquals(listOf(NoteEntry::class, NoteEntry::class, LookupEntry::class), recent.map { it::class })
        assertEquals(emptyList<NoteEntry>(), (recent[2] as LookupEntry).notes)
    }

    @Test
    fun `a past Lookup opens to its whole chat and its Notes`() {
        val id =
            run {
                lookups.save(
                    Lookup(
                        "sentence",
                        "First answer.",
                        minutes(1),
                        LookupKind.Explain,
                        listOf(FollowUp("why?", "Because.")),
                        crime(3, 0),
                    ),
                )
            }
        run { lookups.addFollowUp(id, FollowUp("and then?", "He left.")) }
        val noteId = note("Remember.", minutes(2), crime(3, 0), id)

        val opened = run { pages.lookup(id) }!!

        assertEquals("First answer.", opened.lookup.answer)
        assertEquals(listOf(FollowUp("why?", "Because."), FollowUp("and then?", "He left.")), opened.lookup.followUps)
        assertEquals(listOf(noteId), opened.notes.map { it.id })
    }

    @Test
    fun `a Note's text can be edited, without the space around it`() {
        val id = note("Frist thought.", minutes(1))

        run { pages.editNote(id, "  First thought.\n") }

        assertEquals("First thought.", run { notes.all() }.single().value.text)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `a Note can't be edited to nothing`() {
        val id = note("Thought.", minutes(1))

        run { pages.editNote(id, "  ") }
    }

    @Test
    fun `deleting a Note leaves its Lookup`() {
        val garret = lookup("garret", minutes(1), crime(3, 0))
        val onGarret = note("On garret.", minutes(2), crime(3, 0), garret)

        run { pages.deleteNote(onGarret) }

        assertEquals(emptyList<NoteEntry>(), run { pages.lookup(garret) }!!.notes)
    }

    @Test
    fun `deleting a Lookup deletes its follow-ups and its Notes, and nothing else`() {
        val garret = lookup("garret", minutes(1), crime(3, 0))
        run { lookups.addFollowUp(garret, FollowUp("why?", "Because.")) }
        note("On garret.", minutes(2), crime(3, 0), garret)
        val axe = lookup("axe", minutes(3), crime(3, 10))
        val alone = note("Alone.", minutes(4), crime(3, 5))

        run { pages.deleteLookup(garret) }

        assertNull(run { pages.lookup(garret) })
        assertEquals(listOf(alone, axe), run { pages.page(book.bookUrl) }.single().entries.map { it.id })
        assertEquals(1, run { notes.all() }.size)
        assertEquals(
            0L,
            database.lookupQueries
                .allFollowUps()
                .executeAsList()
                .size
                .toLong(),
        )
    }

    @Test
    fun `a Define with Book context goes on that book's page, one without on No book`() {
        val sentence = "He had successfully avoided meeting his landlady on the staircase."
        val chapter = "Part I, Chapter 1\n$sentence"
        val legado = FakeLegado(listOf(book), mapOf((book.bookUrl to book.chapterIndex) to chapter))

        run { gloss(legado).define(Selection.from(sentence)!!) }
        run { gloss(FakeLegado.off).define(Selection.from("garret")!!) }

        val onBook = run { pages.page(book.bookUrl) }.single()
        assertEquals(book.chapterIndex, onBook.chapterIndex)
        assertEquals("Part I, Chapter 1", onBook.chapter)
        assertEquals(sentence, (onBook.entries.single() as LookupEntry).lookup.selection)
        assertEquals("garret", (run { pages.page(null) }.single().entries.single() as LookupEntry).lookup.selection)
    }
}
