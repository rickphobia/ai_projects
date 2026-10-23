package com.rickphobia.ricknotes.core.session

/** A clock that only moves when the test says so, running whatever falls due. */
internal class FakeClock : Clock {
    private var now = 0L
    private val tasks = mutableListOf<Pair<Long, () -> Unit>>()

    override fun nowMs(): Long = now

    override fun schedule(
        delayMs: Long,
        task: () -> Unit,
    ): Scheduled {
        val entry = now + delayMs to task
        tasks.add(entry)
        return Scheduled { tasks.remove(entry) }
    }

    fun advance(ms: Long) {
        val until = now + ms
        while (true) {
            val next = tasks.filter { it.first <= until }.minByOrNull { it.first } ?: break
            tasks.remove(next)
            now = next.first
            next.second()
        }
        now = until
    }
}
