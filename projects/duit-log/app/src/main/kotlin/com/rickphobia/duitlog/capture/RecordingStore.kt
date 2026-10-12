package com.rickphobia.duitlog.capture

import com.rickphobia.duitlog.core.reader.Wallet
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/** One Wallet notification as the recorder kept it. */
data class Recording(
    val wallet: Wallet,
    val packageName: String,
    // Android's key for the notification: the same key posted again is an update in place.
    val notificationKey: String,
    val postedAt: Instant,
    val title: String,
    val text: String,
    val expandedText: String,
)

enum class RecordOutcome {
    RECORDED,

    /** The same notification posted again with the same words; nothing new to keep. */
    REPEAT,

    /** The file reached its size cap; the recording was dropped. */
    FULL,
}

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

    /** Every recording, oldest first. */
    val recordings: StateFlow<List<Recording>> = state.asStateFlow()

    /** Lines that couldn't be read back when the file was loaded, for the log. */
    var damagedLines = 0
        private set

    init {
        if (file.exists()) {
            val decoded = file.readLines().map(::decode)
            damagedLines = decoded.count { it == null }
            state.value = decoded.filterNotNull()
        }
    }

    @Synchronized
    fun record(recording: Recording): RecordOutcome {
        val previous = state.value.lastOrNull { it.notificationKey == recording.notificationKey }
        val line = encode(recording) + "\n"
        val outcome =
            when {
                previous != null && previous.sameWords(recording) -> RecordOutcome.REPEAT
                file.length() + line.toByteArray().size > maxBytes -> RecordOutcome.FULL
                else -> RecordOutcome.RECORDED
            }
        if (outcome == RecordOutcome.RECORDED) {
            file.parentFile?.mkdirs()
            file.appendText(line)
            state.value += recording
        }
        return outcome
    }

    @Synchronized
    fun clear() {
        if (file.exists() && !file.delete()) error("couldn't delete ${file.name}")
        state.value = emptyList()
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
        private const val FIELDS = 7

        private fun encode(recording: Recording) =
            with(recording) {
                listOf(
                    wallet.name,
                    packageName,
                    notificationKey,
                    postedAt.toEpochMilli().toString(),
                    title,
                    text,
                    expandedText,
                ).joinToString("\t", transform = ::escape)
            }

        private fun decode(line: String): Recording? {
            val fields = line.split("\t").map(::unescape)
            if (fields.size != FIELDS) return null
            // In the order encode writes them.
            val next = fields.iterator()
            val walletName = next.next()
            val wallet = Wallet.entries.firstOrNull { it.name == walletName }
            val packageName = next.next()
            val notificationKey = next.next()
            val millis = next.next().toLongOrNull()
            return if (wallet != null && millis != null) {
                Recording(
                    wallet = wallet,
                    packageName = packageName,
                    notificationKey = notificationKey,
                    postedAt = Instant.ofEpochMilli(millis),
                    title = next.next(),
                    text = next.next(),
                    expandedText = next.next(),
                )
            } else {
                null
            }
        }

        // Tabs separate fields and new lines separate recordings, so both are escaped.
        private fun escape(field: String) =
            buildString {
                field.forEach { char ->
                    when (char) {
                        '\\' -> append("\\\\")
                        '\t' -> append("\\t")
                        '\n' -> append("\\n")
                        '\r' -> append("\\r")
                        else -> append(char)
                    }
                }
            }

        private fun unescape(field: String) =
            buildString {
                var escaped = false
                field.forEach { char ->
                    when {
                        escaped -> {
                            append(
                                when (char) {
                                    't' -> '\t'
                                    'n' -> '\n'
                                    'r' -> '\r'
                                    else -> char
                                },
                            )
                            escaped = false
                        }

                        char == '\\' -> {
                            escaped = true
                        }

                        else -> {
                            append(char)
                        }
                    }
                }
            }
    }
}

/** The text file "Share" sends: a header, then each recording in the order it arrived. */
object RecordingsText {
    private val timeFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss xxx")

    fun format(
        recordings: List<Recording>,
        zone: ZoneId,
    ) = buildString {
        append("duit-log recordings: ${recordings.size} Wallet notifications\n")
        append("Blank out names, phone numbers and anything else private before passing this on.\n")
        recordings.forEachIndexed { index, recording ->
            append("\n--- ${index + 1} ---\n")
            append("App: ${recording.wallet.label} (${recording.packageName})\n")
            append("Time: ${timeFormat.format(ZonedDateTime.ofInstant(recording.postedAt, zone))}\n")
            append("Key: ${recording.notificationKey}\n")
            append("Title: ${recording.title}\n")
            append("Text: ${recording.text}\n")
            append("Expanded text:\n${recording.expandedText}\n")
        }
    }
}
