package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.ai.Ai
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.ai.TokenUsage
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.context.NoBookContextReason
import com.rickphobia.gloss.core.lookup.Lookup
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.core.settings.GlossSettings
import com.rickphobia.gloss.core.storage.GlossDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class DefineTest {
    private val now = Instant.parse("2026-10-25T09:30:00Z")
    private val settings =
        GlossSettings(defineModel = "claude-haiku-5-5", defineMaxTokens = 150, contextWordLimit = 3000)
    private val lookups =
        JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
            .also(GlossDatabase.Schema::create)
            .let { SqlLookupStore(GlossDatabase(it)) }

    private fun glossWith(ai: Ai) = Gloss(ai, FakeLegado.off, lookups, Clock.fixed(now, ZoneOffset.UTC)) { settings }

    private fun define(
        ai: Ai,
        text: String = "garret",
    ): DefineResult = runBlocking { glossWith(ai).define(Selection.from(text)!!) }

    private val legadoOff = BookContextResult.Missing(NoBookContextReason.LegadoOff)

    @Test
    fun `shows the AI's answer without the space around it`() {
        val result = define(FakeAi(answer("  A small room under the roof of a house.\n")))

        assertEquals(DefineResult.Answer("A small room under the roof of a house.", legadoOff), result)
    }

    @Test
    fun `saves the answer as a Lookup with the Selection and the time`() {
        define(FakeAi(answer("A small room under the roof.")), text = "garret")

        val saved = runBlocking { lookups.all() }
        assertEquals(listOf(Lookup("garret", "A small room under the roof.", now)), saved)
    }

    @Test
    fun `sends the Selection alone to the Define model with the Define instructions`() {
        val ai = FakeAi(answer("A small room under the roof."))

        define(ai, text = "  a garret ")

        val prompt = ai.prompts.single()
        assertEquals("a garret", prompt.userMessage)
        assertEquals("claude-haiku-5-5", prompt.model)
        assertEquals(150, prompt.maxTokens)
        assertTrue(prompt.system.contains("one or two short, plain lines"))
        assertTrue(prompt.system.contains("whole sentence"))
    }

    @Test
    fun `each failure is shown and nothing is saved`() {
        for (failure in AiFailure.entries) {
            val result = define(FakeAi(AiReply.Failed(failure)))

            assertEquals(DefineResult.Failed(failure), result)
        }
        assertEquals(emptyList<Lookup>(), runBlocking { lookups.all() })
    }

    @Test
    fun `a failure that still used tokens is shown the same way`() {
        val result = define(FakeAi(AiReply.Failed(AiFailure.AiError, TokenUsage(80, 0))))

        assertEquals(DefineResult.Failed(AiFailure.AiError), result)
    }

    @Test
    fun `an empty answer is an AI error and is not saved`() {
        val result = define(FakeAi(answer(" \n")))

        assertEquals(DefineResult.Failed(AiFailure.AiError), result)
        assertEquals(emptyList<Lookup>(), runBlocking { lookups.all() })
    }

    @Test
    fun `Lookups are kept oldest first`() {
        val ai = FakeAi(answer("Meaning."))
        val gloss = glossWith(ai)

        runBlocking {
            gloss.define(Selection.from("garret")!!)
            gloss.define(Selection.from("axe")!!)
        }

        assertEquals(listOf("garret", "axe"), runBlocking { lookups.all() }.map { it.selection })
    }
}
