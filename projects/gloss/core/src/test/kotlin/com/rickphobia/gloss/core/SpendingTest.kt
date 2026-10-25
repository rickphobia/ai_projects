package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.ai.TokenUsage
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.core.spending.MonthSpend
import com.rickphobia.gloss.core.spending.SqlSpendStore
import com.rickphobia.gloss.core.storage.GlossDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class SpendingTest {
    private val database =
        GlossDatabase(JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).also(GlossDatabase.Schema::create))
    private val spends = SqlSpendStore(database)
    private val lookups = SqlLookupStore(database)
    private val kualaLumpur = ZoneId.of("Asia/Kuala_Lumpur")
    private val now = Instant.parse("2026-10-25T09:30:00Z")

    /** 1,000,000 input and 100,000 output tokens on Haiku 5.5: $0.10 + $0.05. */
    private val fifteenCents = TokenUsage(inputTokens = 1_000_000, outputTokens = 100_000)

    private fun gloss(
        ai: FakeAi,
        at: Instant = now,
        limitMicros: Long = 1_000_000,
    ) = Gloss(
        ai,
        FakeLegado.off,
        GlossStorage(lookups, spends, FakeNoteStore()),
        Clock.fixed(at, kualaLumpur),
        { testSettings.copy(spendingLimitMicros = limitMicros) },
    )

    private fun define(gloss: Gloss) = runBlocking { gloss.define(Selection.from("garret")!!) }

    private fun spent(at: Instant = now) = runBlocking { gloss(FakeAi(), at).monthSpend() }

    private fun spendEarlier(micros: Long) = runBlocking { spends.add(micros, now.minusSeconds(60)) }

    @Test
    fun `a call's cost comes from its tokens and the model's price`() {
        define(gloss(FakeAi(AiReply.Answer("A small room.", fifteenCents))))

        assertEquals(MonthSpend(150_000, 1_000_000, LocalDate.of(2026, 11, 1)), spent())
    }

    @Test
    fun `under 80 percent the answer has no warning`() {
        spendEarlier(600_000)

        val result = define(gloss(FakeAi(AiReply.Answer("A small room.", fifteenCents))))

        assertFalse((result as DefineResult.Answer).nearLimit)
    }

    @Test
    fun `past 80 percent the answer warns`() {
        spendEarlier(700_000)

        val result = define(gloss(FakeAi(AiReply.Answer("A small room.", fifteenCents))))

        assertTrue((result as DefineResult.Answer).nearLimit)
        assertTrue(spent().nearLimit)
    }

    @Test
    fun `at the limit no call is made and the card gets the reset date`() {
        spendEarlier(1_000_000)
        val ai = FakeAi()

        val result = define(gloss(ai))

        assertEquals(DefineResult.LimitReached(LocalDate.of(2026, 11, 1)), result)
        assertEquals(emptyList<Any>(), ai.prompts)
    }

    @Test
    fun `a failed call that cost money counts toward the limit`() {
        define(gloss(FakeAi(AiReply.Failed(AiFailure.AiError, fifteenCents))))

        assertEquals(150_000, spent().spentMicros)
    }

    @Test
    fun `a failed call that never reached the model costs nothing`() {
        define(gloss(FakeAi(AiReply.Failed(AiFailure.NoInternet))))

        assertEquals(0, spent().spentMicros)
    }

    @Test
    fun `the month rolls over at midnight in the phone's time zone`() {
        // 23:30 on 31 October in Kuala Lumpur (UTC+8) is still October 15:30 UTC.
        val lateOctober = Instant.parse("2026-10-31T15:30:00Z")
        // 00:30 on 1 November in Kuala Lumpur, though still 31 October in UTC.
        val earlyNovember = Instant.parse("2026-10-31T16:30:00Z")
        define(gloss(FakeAi(AiReply.Answer("A small room.", fifteenCents)), at = lateOctober, limitMicros = 150_000))

        assertEquals(
            DefineResult.LimitReached(LocalDate.of(2026, 11, 1)),
            define(gloss(FakeAi(), lateOctober, 150_000)),
        )
        assertTrue(define(gloss(FakeAi(), earlyNovember, 150_000)) is DefineResult.Answer)
        assertEquals(MonthSpend(18, 1_000_000, LocalDate.of(2026, 12, 1)), spent(earlyNovember))
    }
}
