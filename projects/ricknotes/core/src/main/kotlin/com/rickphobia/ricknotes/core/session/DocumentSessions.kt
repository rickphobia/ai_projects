package com.rickphobia.ricknotes.core.session

import java.nio.file.Path

/**
 * One Document session per open Document, counted by the Tabs showing it, so two Tabs of one PDF
 * (in either Pane) share its ink and its undo history. Each entry is the app's [H], which holds
 * the session found with [sessionOf].
 *
 * Closing the last Tab saves on [saveThread] and ends the session once its ink is saved. Until
 * then it keeps retrying, and reopening the Document gets the same session back with every stroke,
 * instead of reading an Ink file that is about to be replaced.
 */
class DocumentSessions<H : Any>(
    private val sessionOf: (H) -> DocumentSession,
    private val saveThread: (() -> Unit) -> Unit,
) {
    private class Entry<H>(
        val held: H,
    ) {
        var tabs = 0

        // Tabs moving to the other Pane, counted in [tabs] until they open there.
        var handedOver = 0
    }

    private val entries = mutableMapOf<Path, Entry<H>>()

    /** The open session of [pdf], or a new one from [open] (which may be slow), for one more Tab. */
    @Synchronized
    fun open(
        pdf: Path,
        open: () -> H,
    ): H {
        val entry = entries.getOrPut(pdf) { Entry(open()) }
        if (entry.handedOver > 0) entry.handedOver-- else entry.tabs++
        return entry.held
    }

    /**
     * A Tab of [pdf] is moving to another Pane: its old place closes before the new one opens, so
     * this keeps the session (and its undo history) for the next [open] instead of saving and
     * ending it in between. Does nothing when [pdf] isn't open.
     */
    @Synchronized
    fun handOver(pdf: Path) {
        val entry = entries[pdf] ?: return
        entry.tabs++
        entry.handedOver++
    }

    /**
     * One Tab of [pdf] closed. When it was the last, saves, ends the session if that worked, and
     * tells [closed] whether the ink was saved.
     */
    fun close(
        pdf: Path,
        closed: (saved: Boolean) -> Unit,
    ) {
        val entry =
            synchronized(this) {
                val entry = checkNotNull(entries[pdf]) { "closing ${pdf.fileName}, which is not open" }
                entry.tabs--
                entry.takeIf { it.tabs == 0 }
            } ?: return
        saveThread {
            val session = sessionOf(entry.held)
            session.saveNow()
            val saved = session.status == SaveStatus.SAVED
            // Reopened while it saved: the new Tab keeps it.
            synchronized(this) { if (saved && entry.tabs == 0) entries.remove(pdf) }
            closed(saved)
        }
    }

    /** True while a Tab shows [pdf], or its ink is not yet saved. */
    @Synchronized
    fun isOpen(pdf: Path): Boolean = pdf in entries
}
