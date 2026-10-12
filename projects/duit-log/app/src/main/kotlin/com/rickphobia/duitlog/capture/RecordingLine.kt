package com.rickphobia.duitlog.capture

import com.rickphobia.duitlog.core.reader.Wallet
import java.time.Instant

/**
 * How [RecordingStore] writes a [Recording] as one line of its file: tab-separated fields, with
 * tabs, new lines and backslashes in the text escaped.
 */
internal object RecordingLine {
    private const val FIELDS = 7

    fun encode(recording: Recording) =
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

    /** The recording on [line], or null when the line is damaged. */
    fun decode(line: String): Recording? {
        val fields = line.split("\t").map(::unescape)
        if (fields.size != FIELDS) return null
        // In the order encode writes them.
        val field = fields.iterator()
        val walletName = field.next()
        val wallet = Wallet.entries.firstOrNull { it.name == walletName }
        val packageName = field.next()
        val notificationKey = field.next()
        val millis = field.next().toLongOrNull()
        return if (wallet != null && millis != null) {
            Recording(
                wallet = wallet,
                packageName = packageName,
                notificationKey = notificationKey,
                postedAt = Instant.ofEpochMilli(millis),
                title = field.next(),
                text = field.next(),
                expandedText = field.next(),
            )
        } else {
            null
        }
    }

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
