package com.rickphobia.duitlog.logging

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class RollingLogFileTest {
    @get:Rule
    val folder = TemporaryFolder()

    private fun read(name: String) = File(folder.root, name).readText()

    @Test
    fun `appends lines to the current file`() {
        val log = RollingLogFile(folder.root, maxBytes = 1_000)
        log.append("first")
        log.append("second")
        assertEquals("first\nsecond\n", read(RollingLogFile.CURRENT))
    }

    @Test
    fun `rotates to the old file when the current one would pass the cap`() {
        val log = RollingLogFile(folder.root, maxBytes = 10)
        log.append("aaaa") // 5 bytes
        log.append("bbbb") // 10 bytes
        log.append("cccc") // would be 15, so rotate first
        assertEquals("aaaa\nbbbb\n", read(RollingLogFile.OLD))
        assertEquals("cccc\n", read(RollingLogFile.CURRENT))
    }

    @Test
    fun `a second rotation drops the oldest lines so the total stays within twice the cap`() {
        val log = RollingLogFile(folder.root, maxBytes = 10)
        listOf("aaaa", "bbbb", "cccc", "dddd", "eeee").forEach(log::append)
        assertEquals("cccc\ndddd\n", read(RollingLogFile.OLD))
        assertEquals("eeee\n", read(RollingLogFile.CURRENT))
        val total = folder.root.listFiles()!!.sumOf { it.length() }
        assertTrue("total was $total bytes", total <= 20)
    }

    @Test
    fun `a line longer than the cap is cut so one write can't pass it`() {
        val log = RollingLogFile(folder.root, maxBytes = 10)
        log.append("x".repeat(50))
        assertEquals("xxxxxxxxx\n", read(RollingLogFile.CURRENT))
    }

    @Test
    fun `keeps rotating across a restart`() {
        RollingLogFile(folder.root, maxBytes = 10).append("aaaaaaaa")
        RollingLogFile(folder.root, maxBytes = 10).append("bbbb")
        assertEquals("aaaaaaaa\n", read(RollingLogFile.OLD))
        assertEquals("bbbb\n", read(RollingLogFile.CURRENT))
    }

    @Test
    fun `exports the old then the current lines as one file`() {
        val log = RollingLogFile(folder.root, maxBytes = 10)
        listOf("aaaa", "bbbb", "cccc").forEach(log::append)
        val target = File(folder.newFolder("share"), "log.txt")
        log.exportTo(target)
        assertEquals("aaaa\nbbbb\ncccc\n", target.readText())
    }

    @Test
    fun `exports an empty file when nothing was logged`() {
        val target = File(folder.newFolder("share"), "log.txt")
        RollingLogFile(File(folder.root, "logs"), maxBytes = 10).exportTo(target)
        assertEquals("", target.readText())
    }
}
