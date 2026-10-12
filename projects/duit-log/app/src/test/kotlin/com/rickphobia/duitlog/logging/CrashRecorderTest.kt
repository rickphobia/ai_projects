package com.rickphobia.duitlog.logging

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException

class CrashRecorderTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val handedOn = mutableListOf<Pair<Thread, Throwable>>()
    private val previous = Thread.UncaughtExceptionHandler { thread, error -> handedOn.add(thread to error) }

    private fun crash(): Throwable =
        IllegalStateException("outer", IllegalArgumentException("Received duplicate input"))

    @Test
    fun `a crash is written to the log file with the thread and whole stack trace, then handed on`() {
        val log = RollingLogFile(folder.root, maxBytes = 100_000)
        val thread = Thread("ink-save")
        val error = crash()

        CrashRecorder(log::append, previous).uncaughtException(thread, error)

        val written = File(folder.root, RollingLogFile.CURRENT).readText()
        assertTrue(written, written.contains("crashed on thread ink-save"))
        assertTrue(written, written.contains("java.lang.IllegalStateException: outer"))
        assertTrue(written, written.contains("Caused by: java.lang.IllegalArgumentException: Received duplicate input"))
        assertTrue(written, written.contains("at com.rickphobia.duitlog.logging.CrashRecorderTest.crash"))
        assertEquals(listOf(thread to error), handedOn)
    }

    @Test
    fun `the crash is still handed on when writing it fails`() {
        val error = crash()
        val recorder = CrashRecorder({ throw IOException("disk full") }, previous)

        val thrown = assertThrows(IOException::class.java) { recorder.uncaughtException(Thread.currentThread(), error) }

        assertEquals("disk full", thrown.message)
        assertSame(error, handedOn.single().second)
    }
}
