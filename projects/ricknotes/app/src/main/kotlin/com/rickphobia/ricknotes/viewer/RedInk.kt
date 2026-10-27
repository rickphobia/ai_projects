package com.rickphobia.ricknotes.viewer

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.redink.MarkedPage
import com.rickphobia.ricknotes.core.redink.RedMark
import com.rickphobia.ricknotes.core.redink.RedMarks
import com.rickphobia.ricknotes.core.revisionlog.loggedRedStrokes
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.ink.DocumentInk
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.revisionlog.CourseFolder
import com.rickphobia.ricknotes.revisionlog.RevisionLogAdder
import com.rickphobia.ricknotes.revisionlog.RevisionLogSessions
import com.rickphobia.ricknotes.revisionlog.rememberRevisionLogAdder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.withContext
import java.io.IOException

// A burst of strokes is counted once, after it pauses.
private const val RECOUNT_DELAY_MS = 500L

// Red marks turn a minute old while nothing changes, so they are counted again this often.
private const val RECOUNT_INTERVAL_MS = 60_000L

/**
 * The Red marks of one open Document with its [pages], [ink] and [course] (null when it is in
 * none), for the Red ink badge and list, and the one the student jumped to last, which its page
 * outlines until the ink changes. Red marks go to the Revision log through [adder].
 */
internal class RedInk(
    val pages: PdfPages,
    private val pageSizes: List<PageSize>,
    val ink: DocumentInk,
    val course: CourseFolder?,
    val adder: RevisionLogAdder,
) {
    var marks by mutableStateOf<List<RedMark>>(emptyList())
        private set

    var jumpedTo by mutableStateOf<RedMark?>(null)
        private set

    /** Counts jumps, so picking the same Red mark again scrolls to it again. */
    var jumps by mutableIntStateOf(0)
        private set

    // True when the Course folder's Revision log is open read-only, so nothing can be logged.
    private var logReadOnly by mutableStateOf(false)

    // Strokes of Red marks being added to the log right now: not offered again while they are.
    private var adding = emptySet<StrokeId>()

    /** True when the badge shows: there are Red marks, and the Document and its log can be written. */
    val offered: Boolean get() = marks.isNotEmpty() && !ink.readOnly && !logReadOnly

    /** The pages as the Document shows them, Inserted pages included. */
    fun shownPages(): List<DocumentPage> = documentPages(ink.pages, pageSizes)

    fun jumpTo(mark: RedMark) {
        jumpedTo = mark
        jumps++
    }

    /** Not a mistake: hides [mark] for good, and drops it from the list at once. */
    fun hide(mark: RedMark) {
        ink.hideNotMistakes(mark.strokeIds.toSet())
        marks = marks - mark
    }

    /**
     * Add mistake: adds [mark] to the Revision log and drops it from the list at once. If it can't
     * be added it comes back with the next count. Returns false when the add couldn't start.
     */
    fun add(mark: RedMark): Boolean {
        val ids = mark.strokeIds.toSet()
        val started = adder.addRedMark(mark) { adding = adding - ids }
        if (started) {
            adding = adding + ids
            marks = marks - mark
        }
        return started
    }

    /** Lets go of the outline, when the ink changes under it. */
    fun forgetJump() {
        jumpedTo = null
    }

    /**
     * Finds the Red marks now: the strokes are read on the main thread, where the ink changes, and
     * grouped off it. Strokes hidden as not a mistake or already in the Revision log are left out.
     * The log is only opened once there are Red marks, so a Document without red ink leaves it alone.
     */
    suspend fun findMarks() {
        val shown = shownPages()
        val strokes = shown.flatMap { page -> ink.on(page.id).map { it.stroke } }
        val marked = shown.map { MarkedPage(it.id, it.size.widthPt.toFloat(), it.size.heightPt.toFloat()) }
        val now = System.currentTimeMillis()
        val leftOut = ink.hiddenStrokes + adding
        var found = withContext(Dispatchers.Default) { RedMarks.find(strokes, marked, now, leftOut) }
        val logged = if (found.isEmpty()) emptySet() else loggedStrokes()
        if (logged.isNotEmpty()) {
            found = withContext(Dispatchers.Default) { RedMarks.find(strokes, marked, now, leftOut + logged) }
        }
        if (found.size != marks.size) AppLog.i("Red ink: ${found.size} Red marks found")
        marks = found
    }

    // The red stroke IDs the Course folder's Revision log holds for this Document, opening it off
    // the main thread; also notes whether it can be written.
    private suspend fun loggedStrokes(): Set<StrokeId> {
        val folder = course?.folder ?: return emptySet()
        return try {
            val session = withContext(Dispatchers.IO) { RevisionLogSessions.open(folder) }
            logReadOnly = session.readOnly
            withContext(Dispatchers.Default) { session.loggedRedStrokes(adder.documentPath) }
        } catch (e: IOException) {
            AppLog.w("Red ink: the Revision log of ${folder.name} can't be opened, so no badge", e)
            logReadOnly = true
            emptySet()
        }
    }
}

/**
 * The Red ink of [document], with the Revision log adder that the Lasso menu uses too, so only one
 * add runs at a time. Finds the Red marks of [ink] off the main thread whenever its strokes
 * change, and once a minute while the Document is open.
 */
@Composable
internal fun rememberRedInk(
    document: PdfEntry,
    pages: PdfPages,
    pageSizes: List<PageSize>,
    ink: DocumentInk,
    course: CourseFolder?,
): RedInk {
    val adder = rememberRevisionLogAdder(document, course, pages, pageSizes, ink)
    val redInk = remember(pages, pageSizes, ink, course, adder) { RedInk(pages, pageSizes, ink, course, adder) }
    LaunchedEffect(redInk) {
        snapshotFlow { ink.revision }.collectLatest {
            // A changed page may have moved or ended the outlined Red mark.
            redInk.forgetJump()
            delay(RECOUNT_DELAY_MS)
            while (true) {
                redInk.findMarks()
                delay(RECOUNT_INTERVAL_MS)
            }
        }
    }
    return redInk
}
