package com.rickphobia.duitlog.capture

import com.rickphobia.duitlog.core.reader.Wallet
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.time.Instant
import java.time.ZoneId

class RecordingStoreTest {
    @get:Rule
    val folder = TemporaryFolder()

    private fun store(maxBytes: Long = 100_000) = RecordingStore(folder.root, maxBytes)

    private fun recording(
        key: String = "0|my.com.tngdigital.ewallet|7|null|10123",
        title: String = "Payment successful",
        text: String = "You have paid RM12.50",
        expandedText: String = "",
        postedAt: String = "2026-10-12T04:30:00Z",
    ) = Recording(
        wallet = Wallet.TNG,
        packageName = "my.com.tngdigital.ewallet",
        notificationKey = key,
        postedAt = Instant.parse(postedAt),
        title = title,
        text = text,
        expandedText = expandedText,
    )

    @Test
    fun `recordings survive a restart, text with tabs, new lines and backslashes included`() {
        val tricky = recording(text = "line one\nline\ttwo \\n not a new line\r\n", expandedText = "a\\tb")
        store().record(tricky)

        assertEquals(listOf(tricky), store().recordings.value)
    }

    @Test
    fun `the same notification posted again unchanged is recorded once`() {
        val store = store()

        assertEquals(RecordOutcome.RECORDED, store.record(recording()))
        assertEquals(RecordOutcome.REPEAT, store.record(recording(postedAt = "2026-10-12T04:31:00Z")))
        assertEquals(1, store.recordings.value.size)
    }

    @Test
    fun `a notification updated in place with new text is recorded again`() {
        val store = store()
        store.record(recording(text = "Payment pending"))

        assertEquals(RecordOutcome.RECORDED, store.record(recording(text = "Payment successful")))
        assertEquals(2, store.recordings.value.size)
    }

    @Test
    fun `the same text from a different notification is recorded again`() {
        val store = store()
        store.record(recording(key = "a"))

        assertEquals(RecordOutcome.RECORDED, store.record(recording(key = "b")))
    }

    @Test
    fun `stops recording once the file is full`() {
        val store = store(maxBytes = 150)
        store.record(recording(key = "a"))

        assertEquals(RecordOutcome.FULL, store.record(recording(key = "b")))
        assertEquals(1, store().recordings.value.size)
    }

    @Test
    fun `clear deletes every recording`() {
        val store = store()
        store.record(recording())

        store.clear()

        assertTrue(store.recordings.value.isEmpty())
        assertTrue(store().recordings.value.isEmpty())
        assertEquals(RecordOutcome.RECORDED, store.record(recording()))
    }

    @Test
    fun `a damaged line is skipped and counted, the rest still load`() {
        store().record(recording(key = "a"))
        File(folder.root, RecordingStore.FILE_NAME).appendText("not a recording\n")
        store().record(recording(key = "b"))

        val reloaded = store()

        assertEquals(listOf("a", "b"), reloaded.recordings.value.map { it.notificationKey })
        assertEquals(1, reloaded.damagedLines)
    }

    @Test
    fun `the shared text lists every recording oldest first with its time in the phone's zone`() {
        val store = store()
        store.record(recording(key = "a", title = "First", postedAt = "2026-10-12T04:30:00Z"))
        store.record(recording(key = "b", title = "Second", expandedText = "More\ndetail"))
        val target = File(folder.root, "shared/recordings.txt")

        store.exportTo(target, ZoneId.of("Asia/Kuala_Lumpur"))

        val text = target.readText()
        assertTrue(text.contains("2 Wallet notifications"))
        assertTrue(text.contains("App: Touch 'n Go eWallet (my.com.tngdigital.ewallet)"))
        assertTrue(text.contains("Time: 2026-10-12 12:30:00 +08:00"))
        assertTrue(text.contains("Expanded text:\nMore\ndetail"))
        assertTrue(text.indexOf("Title: First") < text.indexOf("Title: Second"))
    }

    @Test
    fun `an empty store shares a file that says so`() {
        val target = File(folder.root, "recordings.txt")

        store().exportTo(target, ZoneId.of("UTC"))

        assertTrue(target.readText().contains("0 Wallet notifications"))
        assertFalse(target.readText().contains("App:"))
    }
}
