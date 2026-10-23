package com.rickphobia.ricknotes.revisionlog

import com.rickphobia.ricknotes.core.revisionlog.RevisionLogSession
import com.rickphobia.ricknotes.core.session.InkSaveFailed
import com.rickphobia.ricknotes.core.session.SaveListener
import com.rickphobia.ricknotes.core.session.VersionFailed
import com.rickphobia.ricknotes.ink.SaveThread
import com.rickphobia.ricknotes.logging.AppLog
import java.io.File
import java.time.ZoneId

/**
 * The app's Revision log sessions, one per Course folder, kept while the app runs, so adding from
 * a Document and rating in Review never race on one log. They save on the same background thread
 * as Ink files.
 */
internal object RevisionLogSessions {
    private val sessions = mutableMapOf<String, RevisionLogSession>()

    /** The session of [courseFolder]'s Revision log. Slow the first time: call it off the main thread. */
    @Synchronized
    fun open(courseFolder: File): RevisionLogSession =
        sessions.getOrPut(courseFolder.path) {
            RevisionLogSession
                .open(
                    courseFolder.toPath(),
                    SaveThread,
                    ZoneId.systemDefault(),
                    SaveLog(courseFolder.name),
                ).also {
                    it.damaged?.let { error ->
                        AppLog.w("Revision log of ${courseFolder.name} is open read-only: ${error.message}")
                    }
                }
        }

    /** Saves every log's changes on the save thread without waiting: for when the app goes to the background. */
    fun saveAllInBackground() {
        val open = synchronized(this) { sessions.values.toList() }
        SaveThread.run { open.forEach { it.saveNow() } }
    }
}

// Names the course, never what is in its Entries.
private class SaveLog(
    private val courseName: String,
) : SaveListener {
    override fun saved(
        fileName: String,
        bytes: Int,
        durationMs: Long,
    ) {
        AppLog.i("saved $fileName of $courseName: $bytes bytes in $durationMs ms")
    }

    override fun saveFailed(error: InkSaveFailed) {
        AppLog.e("Revision log save failed for $courseName; will retry", error)
    }

    override fun versionFailed(error: VersionFailed) {
        AppLog.w("Revision log Version failed for $courseName", error)
    }
}
