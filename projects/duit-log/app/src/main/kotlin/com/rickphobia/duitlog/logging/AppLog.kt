package com.rickphobia.duitlog.logging

import android.util.Log
import java.io.File
import java.io.IOException
import java.time.Instant

/**
 * The app's logger. Every line goes to logcat and, once [start] has run, to a rolling file the
 * user can send with "Share log". That file leaves the phone, so log steps, outcomes, counts and
 * errors only: never notification text, Merchant names or Notes.
 */
object AppLog {
    const val TAG = "DuitLog"

    // Weeks of normal use, and still small enough to attach to a message.
    private const val MAX_FILE_BYTES = 1_000_000L

    @Volatile
    private var file: RollingLogFile? = null

    fun start(dir: File) {
        file = RollingLogFile(dir, MAX_FILE_BYTES)
        recordCrashes()
    }

    // Once per process: the activity may be created again, and a second recorder would log twice.
    @Synchronized
    private fun recordCrashes() {
        val current = Thread.getDefaultUncaughtExceptionHandler()
        if (current is CrashRecorder) return
        Thread.setDefaultUncaughtExceptionHandler(
            CrashRecorder({ report ->
                Log.println(Log.ERROR, TAG, report)
                // Each append closes the file, so the report is on disk before the app dies.
                file?.append("${Instant.now()} E $report")
            }, current),
        )
    }

    fun d(message: String) = write(Log.DEBUG, "D", message, null)

    fun i(message: String) = write(Log.INFO, "I", message, null)

    fun w(
        message: String,
        error: Throwable? = null,
    ) = write(Log.WARN, "W", message, error)

    fun e(
        message: String,
        error: Throwable? = null,
    ) = write(Log.ERROR, "E", message, error)

    /** Writes the whole log to [target], for sharing. */
    fun exportTo(target: File) {
        checkNotNull(file) { "AppLog.start was not called" }.exportTo(target)
    }

    private fun write(
        priority: Int,
        level: String,
        message: String,
        error: Throwable?,
    ) {
        Log.println(priority, TAG, if (error == null) message else "$message\n${Log.getStackTraceString(error)}")
        val cause = error?.let { " (${it.javaClass.simpleName}: ${it.cause?.message ?: it.message})" }.orEmpty()
        try {
            file?.append("${Instant.now()} $level [${Thread.currentThread().name}] $message$cause")
        } catch (e: IOException) {
            // A full disk must not crash the app; logcat still has the line.
            Log.w(TAG, "couldn't write the log file", e)
        } catch (e: IllegalStateException) {
            Log.w(TAG, "couldn't rotate the log file", e)
        }
    }
}
