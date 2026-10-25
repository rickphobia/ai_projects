package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.ai.ChatMessage
import com.rickphobia.gloss.core.ai.ChatMessage.Speaker
import com.rickphobia.gloss.core.ai.TokenUsage
import com.rickphobia.gloss.core.context.BookContextPrompt
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.context.BookLocation
import com.rickphobia.gloss.core.context.BookPlace
import com.rickphobia.gloss.core.context.Legado
import com.rickphobia.gloss.core.context.NoBookContextReason
import com.rickphobia.gloss.core.explain.ExplainPrompt
import com.rickphobia.gloss.core.lookup.FollowUp
import com.rickphobia.gloss.core.lookup.Lookup
import com.rickphobia.gloss.core.lookup.LookupKind
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.core.spending.SqlSpendStore
import com.rickphobia.gloss.core.storage.GlossDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

class ExplainTest {
    private val now = Instant.parse("2026-10-25T09:30:00Z")
    private val database =
        GlossDatabase(JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).also(GlossDatabase.Schema::create))
    private val lookups = SqlLookupStore(database)
    private val spends = SqlSpendStore(database)
    private val book = shelfBook()
    private val sentence = "He had successfully avoided meeting his landlady on the staircase."
    private val chapter =
        """
        Part I, Chapter 1
        　　On an exceptionally hot evening early in July a young man came out of the garret in which he lodged.
        　　$sentence
        　　The landlady who provided him with garret, dinners, and attendance, lived on the floor below.
        """.trimIndent()
    private val legado = FakeLegado(listOf(book), mapOf((book.bookUrl to book.chapterIndex) to chapter))

    private fun gloss(
        ai: FakeAi,
        legado: Legado = this.legado,
        limitMicros: Long = testSettings.spendingLimitMicros,
    ) = Gloss(
        ai,
        legado,
        GlossStorage(lookups, spends, FakeNoteStore()),
        Clock.fixed(now, ZoneOffset.UTC),
        { testSettings.copy(spendingLimitMicros = limitMicros) },
    )

    private fun selection(text: String = sentence) = Selection.from(text)!!

    private fun chatOf(result: ExplainResult) = (result as ExplainResult.Answer).chat

    private fun saved() = runBlocking { lookups.all().map { it.value } }

    @Test
    fun `Explain gives a short ELI5 paragraph from Sonnet, with the Book context marked for caching`() {
        val ai = FakeAi(answer("  He sneaked past the woman he owes rent to.\n"))

        val chat = chatOf(runBlocking { gloss(ai).explain(selection()) })

        assertEquals("He sneaked past the woman he owes rent to.", chat.explanation)
        assertEquals("Crime and Punishment", (chat.context as BookContextResult.Found).bookContext.book)
        val prompt = ai.prompts.single()
        assertEquals("claude-sonnet-5-5", prompt.model)
        assertEquals(1024, prompt.maxTokens)
        assertEquals("low", prompt.effort)
        assertTrue(prompt.cacheSystem)
        assertEquals(listOf(ChatMessage(Speaker.Owner, sentence)), prompt.messages)
        assertTrue(prompt.system.startsWith(ExplainPrompt.SYSTEM))
        assertTrue(prompt.system.contains("one short paragraph of plain, simple words"))
        assertTrue(prompt.system.contains("idiom, irony, slang or reference"))
        assertTrue(prompt.system.contains("${'⟪'}$sentence${'⟫'}"))
        assertTrue(prompt.system.contains(BookContextPrompt.SPOILER_RULE))
    }

    @Test
    fun `Explain on one word explains it in context the same way`() {
        val ai = FakeAi(answer("A tiny room right under the roof."))

        chatOf(runBlocking { gloss(ai).explain(selection("garret")) })

        val prompt = ai.prompts.single()
        assertEquals(listOf(ChatMessage(Speaker.Owner, "garret")), prompt.messages)
        assertTrue(prompt.system.contains("If the selection is a single word, explain what it means here"))
        assertTrue(prompt.system.contains("${'⟪'}garret${'⟫'}"))
    }

    @Test
    fun `Explain is saved as an Explain Lookup with its book and chapter`() {
        runBlocking { gloss(FakeAi(answer("He sneaked past her."))).explain(selection()) }

        val place = BookPlace(book.bookUrl, book.chapterIndex, chapter.indexOf(sentence))
        val location = BookLocation("Crime and Punishment", "Fyodor Dostoevsky", "Part I, Chapter 1", place)
        assertEquals(
            listOf(Lookup(sentence, "He sneaked past her.", now, LookupKind.Explain, book = location)),
            saved(),
        )
    }

    @Test
    fun `without Book context Explain answers from the Selection alone`() {
        val ai = FakeAi(answer("He sneaked past her."))

        val chat = chatOf(runBlocking { gloss(ai, FakeLegado.off).explain(selection()) })

        assertEquals(BookContextResult.Missing(NoBookContextReason.LegadoOff), chat.context)
        assertEquals(ExplainPrompt.SYSTEM, ai.prompts.single().system)
    }

    @Test
    fun `follow-ups send the whole chat with the same Book context and Spoiler line`() {
        val ai =
            FakeAi(
                answer("He sneaked past the woman he owes rent to."),
                answer("He owes her money and can't pay."),
                answer("A room right under the roof."),
            )
        val gloss = gloss(ai)

        val first = chatOf(runBlocking { gloss.explain(selection()) })
        val second = chatOf(runBlocking { gloss.followUp(first, "  why is he so nervous? ") })
        val third = chatOf(runBlocking { gloss.followUp(second, "what's a garret?") })

        val systems = ai.prompts.map { it.system }.distinct()
        assertEquals(1, systems.size)
        assertTrue(systems.single().contains(BookContextPrompt.SPOILER_RULE))
        assertTrue(ai.prompts.all { it.cacheSystem && it.model == "claude-sonnet-5-5" })
        assertEquals(
            listOf(
                ChatMessage(Speaker.Owner, sentence),
                ChatMessage(Speaker.Ai, "He sneaked past the woman he owes rent to."),
                ChatMessage(Speaker.Owner, "why is he so nervous?"),
                ChatMessage(Speaker.Ai, "He owes her money and can't pay."),
                ChatMessage(Speaker.Owner, "what's a garret?"),
            ),
            ai.prompts.last().messages,
        )
        assertEquals(
            listOf(
                FollowUp("why is he so nervous?", "He owes her money and can't pay."),
                FollowUp("what's a garret?", "A room right under the roof."),
            ),
            third.followUps,
        )
        assertEquals(first.context, third.context)
        assertEquals("Legado is asked once, for the first turn", 1, legado.chaptersAskedFor.size)
    }

    @Test
    fun `the whole chat is saved with the Lookup`() {
        val gloss = gloss(FakeAi(answer("He sneaked past her."), answer("He owes her rent.")))

        val first = chatOf(runBlocking { gloss.explain(selection()) })
        runBlocking { gloss.followUp(first, "why?") }

        val lookup = saved().single()
        assertEquals("He sneaked past her.", lookup.answer)
        assertEquals(listOf(FollowUp("why?", "He owes her rent.")), lookup.followUps)
    }

    @Test
    fun `a failed follow-up is shown and not saved, and the chat can go on`() {
        val gloss =
            gloss(
                FakeAi(
                    answer("He sneaked past her."),
                    AiReply.Failed(AiFailure.NoInternet),
                    answer("He owes her rent."),
                ),
            )
        val first = chatOf(runBlocking { gloss.explain(selection()) })

        assertEquals(ExplainResult.Failed(AiFailure.NoInternet), runBlocking { gloss.followUp(first, "why?") })
        assertEquals(emptyList<FollowUp>(), saved().single().followUps)

        val retried = chatOf(runBlocking { gloss.followUp(first, "why?") })
        assertEquals(listOf(FollowUp("why?", "He owes her rent.")), retried.followUps)
    }

    @Test
    fun `Explain more starts an Explain chat on the Define's Selection and Book context`() {
        val ai = FakeAi(answer("Got past without being seen."), answer("He dodged his landlady, whom he owes money."))
        val gloss = gloss(ai)
        val defined = runBlocking { gloss.define(selection()) } as DefineResult.Answer

        val chat = chatOf(runBlocking { gloss.explainMore(selection(), defined.context) })

        assertEquals(defined.context, chat.context)
        assertEquals("Legado isn't asked again", 1, legado.chaptersAskedFor.size)
        val explainPrompt = ai.prompts.last()
        assertEquals("claude-sonnet-5-5", explainPrompt.model)
        assertEquals(listOf(ChatMessage(Speaker.Owner, sentence)), explainPrompt.messages)
        assertTrue(explainPrompt.system.contains(BookContextPrompt.SPOILER_RULE))
        assertEquals(listOf(LookupKind.Define, LookupKind.Explain), saved().map { it.kind })
    }

    @Test
    fun `a chat that reaches the limit stops before the next follow-up`() {
        // 1,000,000 input tokens on Sonnet 5.5 is $2.00, the whole limit here.
        val costly = AiReply.Answer("He sneaked past her.", TokenUsage(inputTokens = 1_000_000, outputTokens = 0))
        val ai = FakeAi(costly)
        val gloss = gloss(ai, limitMicros = 2_000_000)
        val first = runBlocking { gloss.explain(selection()) } as ExplainResult.Answer
        assertTrue(first.nearLimit)

        val result = runBlocking { gloss.followUp(first.chat, "why?") }

        assertEquals(ExplainResult.LimitReached(LocalDate.of(2026, 11, 1)), result)
        assertEquals("no call for the follow-up", 1, ai.prompts.size)
        assertEquals(emptyList<FollowUp>(), saved().single().followUps)
    }

    @Test
    fun `at the limit Explain and Explain more make no call`() {
        runBlocking { spends.add(10_000_000, now.minusSeconds(60)) }
        val ai = FakeAi()
        val gloss = gloss(ai)
        val reset = ExplainResult.LimitReached(LocalDate.of(2026, 11, 1))

        assertEquals(reset, runBlocking { gloss.explain(selection()) })
        assertEquals(
            reset,
            runBlocking {
                gloss.explainMore(selection(), BookContextResult.Missing(NoBookContextReason.NotInChapter))
            },
        )
        assertEquals(emptyList<Any>(), ai.prompts)
        assertEquals(emptyList<Any>(), legado.chaptersAskedFor)
    }

    @Test
    fun `cache writes and reads count at their own prices`() {
        // Sonnet 5.5: 1M cache-written tokens at $2.50, 1M cache-read at $0.20, 100K output at $1.00.
        val usage =
            TokenUsage(
                inputTokens = 0,
                outputTokens = 100_000,
                cacheWriteTokens = 1_000_000,
                cacheReadTokens = 1_000_000,
            )

        runBlocking { gloss(FakeAi(AiReply.Answer("He sneaked past her.", usage))).explain(selection()) }

        assertEquals(3_700_000, runBlocking { gloss(FakeAi()).monthSpend() }.spentMicros)
    }
}
