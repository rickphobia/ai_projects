package com.rickphobia.gloss.core.spending

import com.rickphobia.gloss.core.ai.TokenUsage
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth

/** What a model charges, in millionths of a dollar per million tokens. */
data class ModelPrice(
    val inputMicrosPerMillion: Long,
    val outputMicrosPerMillion: Long,
) {
    fun costMicros(usage: TokenUsage): Long =
        (usage.inputTokens * inputMicrosPerMillion + usage.outputTokens * outputMicrosPerMillion) / TOKENS_PER_PRICE

    private companion object {
        const val TOKENS_PER_PRICE = 1_000_000L
    }
}

/** The storage port for what AI calls cost. Costs are millionths of a dollar. */
interface SpendStore {
    suspend fun add(
        costMicros: Long,
        at: Instant,
    )

    /** The sum of the costs from [from] (included) to [until] (not included). */
    suspend fun totalBetween(
        from: Instant,
        until: Instant,
    ): Long
}

/** This calendar month's spend against the Spending limit, in millionths of a dollar. */
data class MonthSpend(
    val spentMicros: Long,
    val limitMicros: Long,
    /** The first day of next month, when the spend starts again from zero. */
    val resetsOn: LocalDate,
) {
    val limitReached: Boolean get() = spentMicros >= limitMicros

    /** Past 80% of the limit, when the card warns. */
    val nearLimit: Boolean get() = spentMicros * WARNING_DENOMINATOR > limitMicros * WARNING_NUMERATOR

    private companion object {
        const val WARNING_NUMERATOR = 4L
        const val WARNING_DENOMINATOR = 5L
    }
}

/**
 * Counts what each AI call costs and sums it per calendar month in the [clock]'s time zone, which
 * on the phone is the phone's.
 */
class Spending(
    private val store: SpendStore,
    private val clock: Clock,
) {
    suspend fun thisMonth(limitMicros: Long): MonthSpend {
        val month = YearMonth.now(clock)
        val start = month.atDay(1)
        val next = month.plusMonths(1).atDay(1)
        val spent =
            store.totalBetween(
                start.atStartOfDay(clock.zone).toInstant(),
                next.atStartOfDay(clock.zone).toInstant(),
            )
        return MonthSpend(spent, limitMicros, next)
    }

    /** Records what a call cost, failed or not. */
    suspend fun record(
        usage: TokenUsage,
        price: ModelPrice,
    ) {
        val cost = price.costMicros(usage)
        if (cost > 0) store.add(cost, clock.instant())
    }
}
