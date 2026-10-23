package com.rickphobia.ricknotes.core.revisionlog

import java.time.LocalDate
import kotlin.math.roundToInt

/**
 * When Review shows an Entry again (spec, "Schedule"): first [FIRST_GAP_DAYS] after it is added;
 * Good stretches the gap by [GOOD_GAP_FACTOR] (3 → 7 → 16 → 37 days); Again brings it back in
 * [AGAIN_GAP_DAYS] and the stretching starts over.
 */
object ReviewSchedule {
    const val FIRST_GAP_DAYS = 3
    const val GOOD_GAP_FACTOR = 2.3
    const val AGAIN_GAP_DAYS = 1

    /** A new Entry's schedule, added on [today]. */
    fun first(today: LocalDate): Schedule = Schedule(today.plusDays(FIRST_GAP_DAYS.toLong()), FIRST_GAP_DAYS)

    /** The schedule after [grade] was given on [today] to an Entry on [schedule]. */
    fun after(
        schedule: Schedule,
        grade: Grade,
        today: LocalDate,
    ): Schedule {
        val gap =
            when (grade) {
                Grade.AGAIN -> {
                    AGAIN_GAP_DAYS
                }

                // Only an Again leaves a gap shorter than the first one, so this is the start over.
                Grade.GOOD -> {
                    if (schedule.gapDays < FIRST_GAP_DAYS) {
                        FIRST_GAP_DAYS
                    } else {
                        (schedule.gapDays * GOOD_GAP_FACTOR).roundToInt()
                    }
                }
            }
        return Schedule(today.plusDays(gap.toLong()), gap)
    }
}
