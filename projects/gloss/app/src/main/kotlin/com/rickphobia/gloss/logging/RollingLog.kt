package com.rickphobia.gloss.logging

import java.io.File
import java.io.IOException
import java.time.Clock

/**
 * The log that "Share log" sends: one line per event in [directory], kept to about twice
 * [maxBytes] by starting a new file and keeping only the one before it. Each line also goes to
 * [echo] (logcat in the app).
 *
 * Callers log what Gloss did (model, tokens, latency, errors), never the Selection, an answer or
 * the key.
 */
class RollingLog(
    private val directory: File,
    private val clock: Clock,
    private val maxBytes: Long = DEFAULT_MAX_BYTES,
    private val echo: (Level, String) -> Unit = { _, _ -> },
) {
    enum class Level { INFO, WARNING, ERROR }

    private val current = File(directory, "gloss.log")
    private val previous = File(directory, "gloss.log.1")

    fun info(message: String) = write(Level.INFO, message)

    fun warning(message: String) = write(Level.WARNING, message)

    fun error(
        message: String,
        cause: Throwable? = null,
    ) = write(Level.ERROR, if (cause == null) message else "$message: $cause")

    /**
     * Appends one line. A file the log can't write to (disk full) is reported through [echo]
     * rather than thrown, so logging never takes the app down with it.
     */
    @Synchronized
    fun write(
        level: Level,
        message: String,
    ) {
        echo(level, message)
        try {
            directory.mkdirs()
            if (current.length() >= maxBytes) rotate()
            current.appendText("${clock.instant()} ${level.name} $message\n")
        } catch (e: IOException) {
            echo(Level.ERROR, "couldn't write the log file: $e")
        }
    }

    private fun rotate() {
        previous.delete()
        if (!current.renameTo(previous)) {
            // Start afresh rather than let the file grow without limit.
            echo(Level.WARNING, "couldn't rotate the log file; starting a new one")
            current.delete()
        }
    }

    /** Writes the whole log, oldest line first, to [target] and returns it. */
    @Synchronized
    fun exportTo(target: File): File {
        target.parentFile?.mkdirs()
        target.writeText(listOf(previous, current).filter(File::exists).joinToString("") { it.readText() })
        return target
    }

    private companion object {
        const val DEFAULT_MAX_BYTES = 256L * 1024
    }
}
