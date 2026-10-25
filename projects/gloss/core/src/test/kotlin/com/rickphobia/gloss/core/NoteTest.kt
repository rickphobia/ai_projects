package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.context.BookLocation
import com.rickphobia.gloss.core.context.BookPlace
import com.rickphobia.gloss.core.context.NoBookContextReason
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.core.note.Note
import com.rickphobia.gloss.core.note.SqlNoteStore
import com.rickphobia.gloss.core.spending.SqlSpendStore
import com.rickphobia.gloss.core.storage.GlossDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class NoteTest {
    private val now = Instant.parse("2026-10-25T09:30:00Z")
    private val database =
        GlossDatabase(JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).also(GlossDatabase.Schema::create))
    private val notes = SqlNoteStore(database)
    private val spends = SqlSpendStore(database)
    private val ai = FakeAi()
    private val book = shelfBook()
    private val sentence = "He had successfully avoided meeting his landlady on the staircase."
    private val legado =
        FakeLegado(listOf(book), mapOf((book.bookUrl to book.chapterIndex) to "Part I, Chapter 1\n$sentence"))
    private val crimeAndPunishment =
        BookLocation(
            "Crime and Punishment",
            "Fyodor Dostoevsky",
            "Part I, Chapter 1",
            BookPlace(book.bookUrl, book.chapterIndex, "Part I, Chapter 1\n".length),
        )

    private fun gloss(legado: FakeLegado = this.legado) =
        Gloss(ai, legado, GlossStorage(SqlLookupStore(database), spends, notes), Clock.fixed(now, ZoneOffset.UTC)) {
            testSettings
        }

    private fun selection(text: String = sentence) = Selection.from(text)!!

    private fun saved() = runBlocking { notes.all().map { it.value } }

    private fun nothingSentToTheAi() {
        assertTrue(ai.prompts.isEmpty())
        assertEquals(0L, runBlocking { gloss().monthSpend().spentMicros })
    }

    @Test
    fun `a Note from the menu is saved with its book and chapter, without the AI`() {
        val gloss = gloss()

        val context = runBlocking { gloss.noteContext(selection()) }
        runBlocking { gloss.note(selection(), "  He owes her rent.\n", context) }

        assertEquals(listOf(Note(sentence, "He owes her rent.", now, crimeAndPunishment)), saved())
        nothingSentToTheAi()
    }

    @Test
    fun `a Note without Book context goes under No book`() {
        val gloss = gloss(FakeLegado.off)

        val context = runBlocking { gloss.noteContext(selection("garret")) }
        runBlocking { gloss.note(selection("garret"), "A tiny attic room.", context) }

        assertEquals(BookContextResult.Missing(NoBookContextReason.LegadoOff), context)
        assertEquals(listOf(Note("garret", "A tiny attic room.", now)), saved())
        nothingSentToTheAi()
    }

    @Test
    fun `a Note on a Define card is attached to its Lookup, with the Lookup's Book context`() {
        val gloss = gloss()
        val defined = runBlocking { gloss.define(selection()) } as DefineResult.Answer
        val promptsBefore = ai.prompts.size
        val spentBefore = runBlocking { gloss.monthSpend().spentMicros }

        runBlocking { gloss.note(selection(), "Remember this.", defined.context, defined.lookupId) }

        assertEquals(listOf(Note(sentence, "Remember this.", now, crimeAndPunishment, defined.lookupId)), saved())
        assertEquals(promptsBefore, ai.prompts.size)
        assertEquals(spentBefore, runBlocking { gloss.monthSpend().spentMicros })
    }

    @Test
    fun `a Note on an Explain card is attached to the chat's Lookup`() {
        val gloss = gloss()
        val chat = (runBlocking { gloss.explain(selection()) } as ExplainResult.Answer).chat

        runBlocking { gloss.note(selection(), "Ask about the landlady.", chat.context, chat.lookupId) }

        assertEquals(chat.lookupId, saved().single().lookupId)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `an empty Note is not saved`() {
        runBlocking { gloss().note(selection(), "   ", BookContextResult.Missing(NoBookContextReason.LegadoOff)) }
    }
}
