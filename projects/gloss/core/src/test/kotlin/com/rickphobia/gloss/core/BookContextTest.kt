package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.context.BookContext
import com.rickphobia.gloss.core.context.BookContextPrompt
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.context.Legado
import com.rickphobia.gloss.core.context.LegadoFailure
import com.rickphobia.gloss.core.context.NoBookContextReason
import com.rickphobia.gloss.core.context.ShelfBook
import com.rickphobia.gloss.core.define.DefinePrompt
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.core.storage.GlossDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class BookContextTest {
    private val settings =
        testSettings
    private val ai = FakeAi()
    private val book = shelfBook()

    private val chapter =
        """
        Part I, Chapter 1
        　　On an exceptionally hot evening early in July a young man came out of the garret in which he lodged.
        　　He had successfully avoided meeting his landlady on the staircase.
        　　The landlady who provided him with garret, dinners, and attendance, lived on the floor below.
        """.trimIndent()

    private fun define(
        legado: Legado,
        selection: String,
    ): DefineResult {
        val lookups =
            JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
                .also(GlossDatabase.Schema::create)
                .let { SqlLookupStore(GlossDatabase(it)) }
        val gloss =
            Gloss(
                ai,
                legado,
                GlossStorage(lookups, FakeSpendStore(), FakeNoteStore()),
                Clock.fixed(Instant.EPOCH, ZoneOffset.UTC),
                { settings },
            )
        return runBlocking { gloss.define(Selection.from(selection)!!) }
    }

    private fun legadoWith(
        text: String,
        reading: ShelfBook = book,
    ) = FakeLegado(listOf(reading), mapOf((reading.bookUrl to reading.chapterIndex) to text))

    private fun contextOf(result: DefineResult): BookContextResult = (result as DefineResult.Answer).context

    private fun foundPassage(result: DefineResult): String =
        (contextOf(result) as BookContextResult.Found).bookContext.passage

    private fun AiPrompt.everything() = system + "\n" + messages.joinToString("\n") { it.text }

    @Test
    fun `uses the book read most recently and its current chapter`() {
        val older = shelfBook(url = "https://example.com/book/1", name = "Older book", lastReadAt = 1_000)
        val neverOpened = shelfBook(url = "https://example.com/book/2", name = "Never opened", lastReadAt = 0)
        val legado = FakeLegado(listOf(older, book, neverOpened), mapOf((book.bookUrl to 3) to chapter))

        val result = define(legado, "garret")

        assertEquals(listOf(book.bookUrl to 3), legado.chaptersAskedFor)
        val context = (contextOf(result) as BookContextResult.Found).bookContext
        assertEquals("Crime and Punishment", context.book)
        assertEquals("Fyodor Dostoevsky", context.author)
        assertEquals("Part I, Chapter 1", context.chapter)
    }

    @Test
    fun `the prompt carries the book, author, chapter, passage and the spoiler rule`() {
        define(legadoWith(chapter), "staircase")

        val prompt = ai.prompts.single()
        assertEquals("staircase", prompt.messages.single().text)
        assertTrue(prompt.system.contains("Crime and Punishment by Fyodor Dostoevsky"))
        assertTrue(prompt.system.contains("\"Part I, Chapter 1\""))
        assertTrue(prompt.system.contains("his landlady on the ⟪staircase⟫."))
        assertTrue(prompt.system.contains(BookContextPrompt.SPOILER_RULE))
        assertTrue(prompt.system.contains("one or two short, plain lines"))
    }

    @Test
    fun `the passage is the chapter up to the Selection's paragraph, one paragraph per line without indents`() {
        val result = define(legadoWith(chapter), "staircase")

        assertEquals(
            "Part I, Chapter 1\n" +
                "On an exceptionally hot evening early in July a young man came out of the garret " +
                "in which he lodged.\n" +
                "He had successfully avoided meeting his landlady on the ⟪staircase⟫.",
            foundPassage(result),
        )
    }

    @Test
    fun `nothing past the Selection's paragraph reaches the AI`() {
        define(legadoWith(chapter), "landlady on the staircase")

        assertFalse(
            ai.prompts
                .single()
                .everything()
                .contains("lived on the floor below"),
        )
        assertFalse(
            ai.prompts
                .single()
                .everything()
                .contains("dinners"),
        )
    }

    @Test
    fun `a Selection found twice is the occurrence nearest the reading position`() {
        val nearSecond = shelfBook(position = chapter.indexOf("dinners"))

        val result = define(legadoWith(chapter, nearSecond), "garret")

        assertTrue(
            foundPassage(
                result,
            ).endsWith("provided him with ⟪garret⟫, dinners, and attendance, lived on the floor below."),
        )
    }

    @Test
    fun `a Selection found twice near the start is the first occurrence`() {
        val result = define(legadoWith(chapter, shelfBook(position = 0)), "garret")

        assertTrue(foundPassage(result).endsWith("came out of the ⟪garret⟫ in which he lodged."))
        assertFalse(
            ai.prompts
                .single()
                .everything()
                .contains("dinners"),
        )
    }

    @Test
    fun `spacing, line breaks, quote and dash styles don't stop a match`() {
        val text = "　　“Yes—I know,” he said,\n　　and   the ‘garret’ — his — was hot…\nNext paragraph."

        val result = define(legadoWith(text), "\"Yes - I know,\" he said, and the 'garret' -- his -- was hot...")

        assertEquals(
            "⟪“Yes—I know,” he said,\nand   the ‘garret’ — his — was hot…⟫",
            foundPassage(result),
        )
    }

    @Test
    fun `a word is only found as a whole word, not inside another`() {
        val result = define(legadoWith(chapter), "eve")

        assertEquals(BookContextResult.Missing(NoBookContextReason.NotInChapter), contextOf(result))
    }

    @Test
    fun `a paragraph ends at any line or paragraph separator`() {
        val text = "The garret was small.\r\nSPOILER one.\u2029SPOILER two."

        define(legadoWith(text), "garret")

        assertFalse(
            ai.prompts
                .single()
                .everything()
                .contains("SPOILER"),
        )
    }

    @Test
    fun `a Selection not in the chapter has no Book context and is sent alone`() {
        val result = define(legadoWith(chapter), "photosynthesis")

        assertEquals(BookContextResult.Missing(NoBookContextReason.NotInChapter), contextOf(result))
        assertEquals(DefinePrompt.SYSTEM, ai.prompts.single().system)
        assertEquals(
            "photosynthesis",
            ai.prompts
                .single()
                .messages
                .single()
                .text,
        )
    }

    @Test
    fun `each Legado failure still answers, without Book context and with the reason`() {
        val reasons =
            mapOf(
                FakeLegado(failure = LegadoFailure.Off) to NoBookContextReason.LegadoOff,
                FakeLegado(failure = LegadoFailure.Slow) to NoBookContextReason.LegadoSlow,
                FakeLegado(failure = LegadoFailure.Error) to NoBookContextReason.LegadoError,
                FakeLegado(listOf(book), chapterFailure = LegadoFailure.Slow) to NoBookContextReason.LegadoSlow,
                FakeLegado(listOf(book), chapterFailure = LegadoFailure.NoFileAccess) to
                    NoBookContextReason.LegadoCantOpenBook,
                FakeLegado(emptyList()) to NoBookContextReason.NoBookRead,
            )

        for ((legado, reason) in reasons) {
            val result = define(legado, "garret")

            assertEquals(DefineResult.Answer("Meaning.", BookContextResult.Missing(reason), lookupId = 1), result)
            assertEquals(DefinePrompt.SYSTEM, ai.prompts.last().system)
        }
    }

    @Test
    fun `at most the word limit before the Selection is sent, plus the rest of its paragraph`() {
        val words = (1..5_000).joinToString(" ") { "w$it" }
        val text = "$words\nThe garret was small, and hot.\nSPOILER: he did it."

        val result = define(legadoWith(text), "garret")

        val passage = foundPassage(result)
        val before = passage.substringBefore(BookContext.SELECTION_START)
        assertTrue(passage.startsWith("… w2002 "))
        assertEquals(3_000, before.removePrefix("…").split(Regex("\\s+")).count(String::isNotEmpty))
        assertTrue(passage.endsWith("The ⟪garret⟫ was small, and hot."))
        assertFalse(
            ai.prompts
                .single()
                .everything()
                .contains("SPOILER"),
        )
    }

    @Test
    fun `a short chapter is sent whole up to the Selection, with no cut mark`() {
        val result = define(legadoWith("Only a few words before the garret."), "garret")

        assertEquals("Only a few words before the ⟪garret⟫.", foundPassage(result))
    }
}
