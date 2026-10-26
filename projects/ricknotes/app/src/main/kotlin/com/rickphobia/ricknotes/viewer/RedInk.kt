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

// A burst of strokes is counted once, after it pauses.
private const val RECOUNT_DELAY_MS = 500L

// Red marks turn a minute old while nothing changes, so they are counted again this often.
private const val RECOUNT_INTERVAL_MS = 60_000L

/**
 * The Red marks of one open Document, for the Red ink badge and list, and the one the student
 * jumped to last, which its page outlines until the ink changes.
 */
internal class RedInk(
    val source: RedInkSource,
) {
    var marks by mutableStateOf<List<RedMark>>(emptyList())

    var shown by mutableStateOf<RedMark?>(null)
        private set

    /** Counts jumps, so picking the same Red mark again scrolls to it again. */
    var jumps by mutableIntStateOf(0)
        private set

    fun jumpTo(mark: RedMark) {
        shown = mark
        jumps++
    }

    /** Lets go of the outline, when the ink changes under it. */
    fun forgetShown() {
        shown = null
    }

    /** True when the Course folder's Revision log is open read-only, so nothing can be logged. */
    var logReadOnly by mutableStateOf(false)
}

/**
 * Finds [ink]'s Red marks off the main thread whenever its strokes change, and once a minute while
 * the Document is open, and checks whether [course]'s Revision log can be written.
 */
@Composable
internal fun rememberRedInk(
    pages: PdfPages,
    pageSizes: List<PageSize>,
    ink: DocumentInk,
    course: CourseFolder?,
): RedInk {
    val redInk = remember(ink, course) { RedInk(RedInkSource(pages, pageSizes, ink, course)) }
    LaunchedEffect(redInk, course) {
        redInk.logReadOnly =
            course != null && withContext(Dispatchers.IO) { RevisionLogSessions.open(course.folder).readOnly }
    }
    LaunchedEffect(redInk, pageSizes) {
        snapshotFlow { ink.revision }.collectLatest {
            // A changed page may have moved or ended the outlined Red mark.
            redInk.forgetShown()
            delay(RECOUNT_DELAY_MS)
            while (true) {
                count(ink, pageSizes, redInk)
                delay(RECOUNT_INTERVAL_MS)
            }
        }
    }
    return redInk
}

// The strokes are read here, on the main thread, where the ink changes; the grouping runs off it.
private suspend fun count(
    ink: DocumentInk,
    pageSizes: List<PageSize>,
    redInk: RedInk,
) {
    val pages = documentPages(ink.pages, pageSizes)
    val strokes = pages.flatMap { page -> ink.on(page.id).map { it.stroke } }
    val marked = pages.map { MarkedPage(it.id, it.size.widthPt.toFloat(), it.size.heightPt.toFloat()) }
    val now = System.currentTimeMillis()
    // Nothing is logged or hidden yet: tickets 41 and 42 add those stroke IDs here.
    val found = withContext(Dispatchers.Default) { RedMarks.find(strokes, marked, now, leftOut = emptySet()) }
    if (found.size != redInk.marks.size) AppLog.i("Red ink: ${found.size} Red marks found")
    redInk.marks = found
}
