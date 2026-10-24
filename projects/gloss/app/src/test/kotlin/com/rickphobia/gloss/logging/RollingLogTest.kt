package com.rickphobia.gloss.logging

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class RollingLogTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val clock = Clock.fixed(Instant.parse("2026-10-25T09:30:00Z"), ZoneOffset.UTC)

    private fun exported(log: RollingLog): List<String> = log.exportTo(File(folder.root, "export/log.txt")).readLines()

    @Test
    fun `writes one timestamped line per event`() {
        val log = RollingLog(File(folder.root, "logs"), clock)

        log.info("define model=claude-haiku-5-5")
        log.error("database failed", IllegalStateException("disk full"))

        assertEquals(
            listOf(
                "2026-10-25T09:30:00Z INFO define model=claude-haiku-5-5",
                "2026-10-25T09:30:00Z ERROR database failed: java.lang.IllegalStateException: disk full",
            ),
            exported(log),
        )
    }

    @Test
    fun `keeps the newest lines and one file before them when it grows past the limit`() {
        val log = RollingLog(File(folder.root, "logs"), clock, maxBytes = 100)

        repeat(20) { log.info("event $it") }

        val lines = exported(log)
        assertEquals("2026-10-25T09:30:00Z INFO event 19", lines.last())
        assertTrue("old lines are dropped: $lines", lines.size < 20)
        assertEquals(lines.sortedBy { it.substringAfter("event ").toInt() }, lines)
    }

    @Test
    fun `sends each line to the echo too`() {
        val echoed = mutableListOf<Pair<RollingLog.Level, String>>()
        val log = RollingLog(File(folder.root, "logs"), clock, echo = { level, message -> echoed += level to message })

        log.warning("retrying")

        assertEquals(listOf(RollingLog.Level.WARNING to "retrying"), echoed)
    }
}
