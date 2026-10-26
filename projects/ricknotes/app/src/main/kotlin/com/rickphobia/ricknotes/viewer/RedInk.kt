package com.rickphobia.ricknotes.viewer

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import com.rickphobia.ricknotes.core.redink.MarkedPage
import com.rickphobia.ricknotes.core.redink.RedMark
import com.rickphobia.ricknotes.core.redink.RedMarks
import com.rickphobia.ricknotes.ink.DocumentInk
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.revisionlog.CourseFolder
import com.rickphobia.ricknotes.revisionlog.RevisionLogSessions
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
 * outlines until the ink changes.
 */
internal class RedInk(
    val pages: PdfPages,
    private val pageSizes: List<PageSize>,
    val ink: DocumentInk,
    val course: CourseFolder?,
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

    /** True when the badge shows: there are Red marks, and the Document and its log can be written. */
    val offered: Boolean get() = marks.isNotEmpty() && !ink.readOnly && !logReadOnly

    /** The pages as the Document shows them, Inserted pages included. */
    fun shownPages(): List<DocumentPage> = documentPages(ink.pages, pageSizes)

    fun jumpTo(mark: RedMark) {
        jumpedTo = mark
        jumps++
    }

    /** Lets go of the outline, when the ink changes under it. */
    fun forgetJump() {
        jumpedTo = null
    }

    /** Finds the Red marks now: the strokes are read on the main thread, where the ink changes, and grouped off it. */
    suspend fun findMarks() {
        val shown = shownPages()
        val strokes = shown.flatMap { page -> ink.on(page.id).map { it.stroke } }
        val marked = shown.map { MarkedPage(it.id, it.size.widthPt.toFloat(), it.size.heightPt.toFloat()) }
        val now = System.currentTimeMillis()
        // Nothing is logged or hidden yet: tickets 41 and 42 add those stroke IDs here.
        val found = withContext(Dispatchers.Default) { RedMarks.find(strokes, marked, now, leftOut = emptySet()) }
        if (found.size != marks.size) AppLog.i("Red ink: ${found.size} Red marks found")
        marks = found
    }

    /** Opens the Course folder's Revision log, off the main thread, to see whether it can be written. */
    suspend fun checkLog() {
        val folder = course?.folder ?: return
        logReadOnly =
            try {
                withContext(Dispatchers.IO) { RevisionLogSessions.open(folder).readOnly }
            } catch (e: IOException) {
                AppLog.w("Red ink: the Revision log of ${folder.name} can't be opened, so no badge", e)
                true
            }
    }
}

/**
 * Finds the Red marks of [ink] off the main thread whenever its strokes change, and once a minute
 * while the Document is open. [course]'s Revision log is only opened once there are some, so a
 * Document without red ink leaves it alone.
 */
@Composable
internal fun rememberRedInk(
    pages: PdfPages,
    pageSizes: List<PageSize>,
    ink: DocumentInk,
    course: CourseFolder?,
): RedInk {
    val redInk = remember(pages, pageSizes, ink, course) { RedInk(pages, pageSizes, ink, course) }
    val anyMarks = redInk.marks.isNotEmpty()
    LaunchedEffect(redInk, anyMarks) { if (anyMarks) redInk.checkLog() }
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
