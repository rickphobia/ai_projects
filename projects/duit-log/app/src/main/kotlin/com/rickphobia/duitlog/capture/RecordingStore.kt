package com.rickphobia.duitlog.capture

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.time.ZoneId

/**
 * The recorder's storage (milestone 1): Wallet notifications only, one line each in a file in the
 * app's private storage, so their real wording can be shared and turned into Notification Reader
 * samples. The file is capped at [maxBytes] so a chatty Wallet can't fill the phone.
 */
class RecordingStore(
    dir: File,
    private val maxBytes: Long,
) {
    private val file = File(dir, FILE_NAME)
    private val state = MutableStateFlow(emptyList<Recording>())
    private val fullState = MutableStateFlow(false)

    /** Every recording, oldest first. */
    val recordings: StateFlow<List<Recording>> = state.asStateFlow()

    /** True once a recording has been dropped because the file reached its cap, until [clear]. */
    val full: StateFlow<Boolean> = fullState.asStateFlow()

    /** Lines that couldn't be read back when the file was loaded, for the log. */
    var damagedLines = 0
        private set

    init {
        if (file.exists()) {
            val decoded = file.readLines().map(RecordingLine::decode)
            damagedLines = decoded.count { it == null }
            state.value = decoded.filterNotNull()
        }
    }

    @Synchronized
    fun record(recording: Recording): RecordOutcome {
        val previous = state.value.lastOrNull { it.notificationKey == recording.notificationKey }
        val line = RecordingLine.encode(recording) + "\n"
        val outcome =
            when {
                previous != null && previous.sameWords(recording) -> RecordOutcome.REPEAT
                file.length() + line.toByteArray().size > maxBytes -> RecordOutcome.FULL
                else -> RecordOutcome.RECORDED
            }
        when (outcome) {
            RecordOutcome.RECORDED -> {
                file.parentFile?.mkdirs()
                file.appendText(line)
                state.value += recording
            }

            RecordOutcome.FULL -> {
                fullState.value = true
            }

            RecordOutcome.REPEAT -> {}
        }
        return outcome
    }

    /** Deletes every recording; throws [RecordingsNotClearedException] if the file stays. */
    @Synchronized
    fun clear() {
        if (file.exists() && !file.delete()) throw RecordingsNotClearedException("couldn't delete ${file.name}")
        state.value = emptyList()
        fullState.value = false
        damagedLines = 0
    }

    /** Writes every recording to [target] as a text file a person can read and blank out. */
    fun exportTo(
        target: File,
        zone: ZoneId,
    ) {
        target.parentFile?.mkdirs()
        target.writeText(RecordingsText.format(state.value, zone))
    }

    private fun Recording.sameWords(other: Recording) =
        title == other.title && text == other.text && expandedText == other.expandedText

    companion object {
        const val FILE_NAME = "recordings.tsv"
    }
}
