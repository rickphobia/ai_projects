package com.rickphobia.duitlog.logging

/**
 * Writes a crash (the thread and the whole stack trace) with [record] before handing it to
 * [previous], which on Android ends the app as usual. Without it an uncaught exception only reaches
 * logcat, which the phone has no way to send.
 */
class CrashRecorder(
    private val record: (String) -> Unit,
    private val previous: Thread.UncaughtExceptionHandler?,
) : Thread.UncaughtExceptionHandler {
    override fun uncaughtException(
        thread: Thread,
        error: Throwable,
    ) {
        try {
            record("crashed on thread ${thread.name}\n${error.stackTraceToString()}")
        } finally {
            previous?.uncaughtException(thread, error)
        }
    }
}
