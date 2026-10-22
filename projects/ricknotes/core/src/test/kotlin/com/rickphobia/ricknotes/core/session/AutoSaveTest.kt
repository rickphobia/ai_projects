package com.rickphobia.ricknotes.core.session

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files
import java.nio.file.Path

/** A clock that only moves when the test says so, running whatever falls due. */
private class ManualClock : Clock {
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

private class FailureCounter : SaveListener {
    var failures = 0

    override fun saveFailed(error: InkSaveFailed) {
        failures++
    }
}

/**
 * The smallest owner of an [AutoSave]: one line of text, as a Revision log session will own its
 * Entries. Drives [AutoSave] the way its owners do.
 */
private class TextOwner(
    file: Path,
    clock: Clock,
    listener: SaveListener,
    readOnly: Boolean = false,
) {
    private var text = ""
    val saving = AutoSave(file, clock, listener, readOnly, snapshot = { text }) { it.toByteArray() }

    fun set(newText: String) =
        synchronized(saving.lock) {
            text = newText
            saving.changed()
        }
}

class AutoSaveTest {
    @get:Rule val folder = TemporaryFolder()

    private val clock = ManualClock()
    private val file: Path by lazy { folder.root.toPath().resolve("revision_log.json") }
    private val temporaryFile: Path get() = file.resolveSibling(".revision_log.json.tmp")
    private val versionsFolder: Path get() = file.resolveSibling(VersionStore.FOLDER)

    private fun owner(
        listener: SaveListener = object : SaveListener {},
        readOnly: Boolean = false,
    ) = TextOwner(file, clock, listener, readOnly)

    private fun versions(): List<String> =
        if (Files.isDirectory(versionsFolder)) {
            Files.list(versionsFolder).use { files ->
                files
                    .iterator()
                    .asSequence()
                    .map { it.fileName.toString() }
                    .sorted()
                    .toList()
            }
        } else {
            emptyList()
        }

    private fun contents() = String(Files.readAllBytes(file))

    @Test
    fun `a change is saved 2 seconds after the last one, or at once when forced`() {
        val owner = owner()
        owner.set("one")
        clock.advance(AutoSave.SAVE_DELAY_MS - 1)
        owner.set("two")
        clock.advance(AutoSave.SAVE_DELAY_MS - 1)
        assertFalse("saved before 2 s had passed since the last change", Files.exists(file))
        assertEquals(SaveStatus.PENDING, owner.saving.status)

        clock.advance(1)
        assertEquals("two", contents())
        assertEquals(SaveStatus.SAVED, owner.saving.status)

        owner.set("three")
        owner.saving.saveNow()
        assertEquals("three", contents())
        assertEquals(SaveStatus.SAVED, owner.saving.status)
    }

    @Test
    fun `a failed save leaves the old file whole, and is retried until it works`() {
        val listener = FailureCounter()
        val owner = owner(listener)
        owner.set("old")
        owner.saving.saveNow()
        // A folder where the temporary file goes makes every write fail, as a full disk would.
        Files.createDirectory(temporaryFile)
        Files.writeString(temporaryFile.resolve("keep"), "x")

        owner.set("new")
        clock.advance(AutoSave.SAVE_DELAY_MS)

        assertEquals("old", contents())
        assertEquals(SaveStatus.FAILED, owner.saving.status)
        assertEquals(1, listener.failures)

        clock.advance(AutoSave.RETRY_DELAY_MS)
        assertEquals("old", contents())
        assertEquals(2, listener.failures)

        temporaryFile.toFile().deleteRecursively()
        clock.advance(AutoSave.RETRY_DELAY_MS)

        assertEquals("new", contents())
        assertEquals(SaveStatus.SAVED, owner.saving.status)
    }

    @Test
    fun `a read-only file is never written`() {
        Files.writeString(file, "{ damaged")
        val owner = owner(readOnly = true)

        owner.saving.saveNow()
        clock.advance(AutoSave.SAVE_DELAY_MS)

        assertEquals("{ damaged", contents())
    }

    @Test
    fun `a Version is taken on open and, while changing, at most every 15 minutes before a save`() {
        Files.writeString(file, "start")
        clock.advance(1_000)
        val owner = owner()
        owner.saving.takeVersion()
        val minute = 60_000L
        repeat(40) { i ->
            owner.set("minute $i")
            clock.advance(minute)
        }

        // On open (1 s), then at the first save at least 15 minutes after the last Version.
        val expected = listOf(1_000L, 15 * minute + 3_000, 30 * minute + 3_000)
        assertEquals(expected.map { "revision_log.json.$it.version" }.sorted(), versions())
        assertEquals("start", String(Files.readAllBytes(versionsFolder.resolve("revision_log.json.1000.version"))))
    }

    @Test
    fun `a Version holds the file as it was before the save that took it`() {
        val owner = owner()
        owner.set("before")
        owner.saving.saveNow()
        val beforeSave = Files.readAllBytes(file)
        clock.advance(AutoSave.VERSION_INTERVAL_MS)

        owner.set("after")
        owner.saving.saveNow()

        assertArrayEquals(beforeSave, Files.readAllBytes(versionsFolder.resolve(versions().single())))
        assertEquals("after", contents())
    }

    @Test
    fun `no Version is taken when there is no file yet`() {
        owner().saving.takeVersion()

        assertTrue(versions().isEmpty())
    }
}
