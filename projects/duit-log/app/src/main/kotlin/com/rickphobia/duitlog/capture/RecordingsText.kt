package com.rickphobia.duitlog.capture

import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

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
