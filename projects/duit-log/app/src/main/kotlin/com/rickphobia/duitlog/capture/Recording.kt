package com.rickphobia.duitlog.capture

import com.rickphobia.duitlog.core.reader.Wallet
import java.io.IOException
import java.time.Instant

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

/** The recordings file couldn't be deleted, so the recordings are still on the phone. */
class RecordingsNotClearedException(
    message: String,
) : IOException(message)
