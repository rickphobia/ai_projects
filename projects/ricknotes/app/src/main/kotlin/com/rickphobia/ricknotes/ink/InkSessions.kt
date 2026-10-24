package com.rickphobia.ricknotes.ink

import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import com.rickphobia.ricknotes.core.session.DocumentSession
import com.rickphobia.ricknotes.core.session.DocumentSessions
import com.rickphobia.ricknotes.core.session.InkSaveFailed
import com.rickphobia.ricknotes.core.session.SaveListener
import com.rickphobia.ricknotes.core.session.SaveStatus
import com.rickphobia.ricknotes.logging.AppLog
import java.io.File

/**
 * A Document session and its save status as Compose state, shared by every Tab of the Document.
 * [revision] counts the changes made to it from any Tab, so the others draw them too.
 */
internal class HeldSession(
    val session: DocumentSession,
    val status: SaveStatusState,
) {
    val revision = mutableIntStateOf(0)
}

/** The app's Document sessions, one per open PDF however many Tabs show it. */
internal object InkSessions {
    private val sessions = DocumentSessions<HeldSession>({ it.session }, SaveThread::run)

    /** Slow when the Ink file has to be read: call it off the main thread. */
    fun open(
        pdf: File,
        pageCount: Int,
    ): HeldSession =
        sessions.open(pdf.toPath()) {
            val status = SaveStatusState(pdf.name)
            val session = DocumentSession.open(pdf.toPath(), pageCount, SaveThread, status)
            session.warnings.forEach { AppLog.w("${pdf.name}: $it") }
            HeldSession(session, status)
        }

    /** A Tab of [pdf] is moving to the other Pane: keeps its session until it opens there. */
    fun handOver(pdf: File) = sessions.handOver(pdf.toPath())

    /** One Tab of [pdf] closed: the last one saves its ink and lets the session go once it is saved. */
    fun close(pdf: File) =
        sessions.close(pdf.toPath()) { saved ->
            if (saved) {
                AppLog.i("closed ${pdf.name}")
            } else {
                AppLog.w("closed ${pdf.name} with ink not yet saved; still retrying")
            }
        }
}

/** The session's save status as Compose state, and the save log. */
internal class SaveStatusState(
    private val documentName: String,
) : SaveListener {
    // Written from the save thread: Compose state may be set from any thread.
    val current = mutableStateOf(SaveStatus.SAVED)

    override fun statusChanged(status: SaveStatus) {
        current.value = status
    }

    override fun saved(
        fileName: String,
        bytes: Int,
        durationMs: Long,
    ) {
        AppLog.i("saved $fileName: $bytes bytes in $durationMs ms")
    }

    override fun saveFailed(error: InkSaveFailed) {
        AppLog.e("save failed for $documentName; will retry", error)
    }
}
