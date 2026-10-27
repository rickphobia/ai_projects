package com.rickphobia.ricknotes.revisionlog

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.rickphobia.ricknotes.core.redink.RedMark
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.EntryKind
import com.rickphobia.ricknotes.core.revisionlog.EntrySource
import com.rickphobia.ricknotes.core.revisionlog.MistakeCategory
import com.rickphobia.ricknotes.core.revisionlog.RevisionLogSession
import com.rickphobia.ricknotes.core.revisionlog.SnipSaveFailed
import com.rickphobia.ricknotes.core.revisionlog.Snips
import com.rickphobia.ricknotes.core.session.PageRect
import com.rickphobia.ricknotes.core.studyfolder.CourseFolders
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.ink.DocumentInk
import com.rickphobia.ricknotes.ink.LassoSelection
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.snip.SnipRegion
import com.rickphobia.ricknotes.snip.renderSnips
import com.rickphobia.ricknotes.viewer.DocumentPage
import com.rickphobia.ricknotes.viewer.PageRenderException
import com.rickphobia.ricknotes.viewer.PageSize
import com.rickphobia.ricknotes.viewer.PdfPages
import com.rickphobia.ricknotes.viewer.RED_MARK_OUTLINE_MARGIN_PT
import com.rickphobia.ricknotes.viewer.documentPages
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/** What the note under the pages says about the last Add mistake or Add key point. */
internal sealed interface RevisionLogNote {
    data class Adding(
        val courseName: String,
    ) : RevisionLogNote

    /** "Added to EE2001 · Edit". */
    data class Added(
        val courseName: String,
        val entry: Entry,
        val session: RevisionLogSession,
    ) : RevisionLogNote

    /** The Document isn't in any Course folder, so it has no Revision log. */
    data object NoCourseFolder : RevisionLogNote

    /** The Course folder's log can't be read, so nothing may be added to it. */
    data class LogUnreadable(
        val courseName: String,
        val reason: String,
    ) : RevisionLogNote

    data class Failed(
        val courseName: String,
    ) : RevisionLogNote
}

/** An open Document's Course folder on disk. */
data class CourseFolder(
    val folder: File,
) {
    val name: String get() = folder.name

    companion object {
        /** [document]'s Course folder inside [studyFolder], or null when it is in none. */
        fun of(
            document: PdfEntry,
            studyFolder: String,
            courseFolders: CourseFolders,
        ): CourseFolder? =
            courseFolders.courseFolderOfDocument(document.treePath)?.let { CourseFolder(File(studyFolder, it)) }
    }
}

/** The adder for the open Document [document], made again only when the Document is. */
@Composable
internal fun rememberRevisionLogAdder(
    document: PdfEntry,
    course: CourseFolder?,
    pages: PdfPages,
    pageSizes: List<PageSize>,
    ink: DocumentInk,
): RevisionLogAdder {
    val scope = rememberCoroutineScope()
    return remember(ink, course) { RevisionLogAdder(document, course, pages, pageSizes, ink, scope) }
}

/**
 * Adds the Lasso selection or a Red mark of one open Document to its Course folder's Revision log,
 * as a Mistake or a Key point, and holds the [note] that says so. Rendering the Snips and writing the files
 * happen off the main thread; the Document's ink and its PDF are only read. Call on the main thread.
 */
internal class RevisionLogAdder(
    private val document: PdfEntry,
    private val course: CourseFolder?,
    private val pages: PdfPages,
    private val pageSizes: List<PageSize>,
    private val ink: DocumentInk,
    private val scope: CoroutineScope,
) {
    var note by mutableStateOf<RevisionLogNote?>(null)
        private set

    /** The Document's path in the Study folder, as its Entries name it. */
    val documentPath: String get() = document.treePath

    /** Adds the selection as an Entry of [kind], then lets go of it. */
    fun add(kind: EntryKind) {
        val selection = ink.lasso.selection
        if (selection == null || note is RevisionLogNote.Adding) return
        if (course == null) {
            AppLog.i("Add to Revision log: ${document.name} is in no Course folder")
            note = RevisionLogNote.NoCourseFolder
        } else {
            add(kind, selection, course)
        }
    }

    private fun add(
        kind: EntryKind,
        selection: LassoSelection,
        course: CourseFolder,
    ) {
        // Numbered as the Document shows it, Inserted pages included.
        val shown = documentPages(ink.pages, pageSizes)
        val pageIndex = shown.indexOfFirst { it.id == selection.pageId }
        val page = shown.getOrNull(pageIndex)
        if (page == null) {
            AppLog.w("Add to Revision log: the selection's page ${selection.pageId.value} isn't shown")
            return
        }
        val area = selection.snipArea
        val snip = SnipRegion.of(area, page.size)
        if (snip == null) {
            AppLog.w("Add to Revision log: the selection on page ${pageIndex + 1} is off the page")
            return
        }
        // Read here, on the main thread: the meshes are drawn again on the render thread.
        val strokes = ink.on(selection.pageId).map { it.mesh }
        val source = EntrySource(document.treePath, selection.pageId, pageIndex + 1, area)
        ink.lasso.clear()
        note = RevisionLogNote.Adding(course.name)
        scope.launch {
            note =
                try {
                    added(course, kind, source, renderSnips(pages, page, snip, strokes))
                } catch (e: PageRenderException) {
                    AppLog.e("Entry not added to ${course.name}: its Snips couldn't be drawn", e)
                    RevisionLogNote.Failed(course.name)
                }
        }
    }

    /**
     * Adds [mark] as a Mistake whose Snips are its whole page, the back with the Red mark outlined,
     * and keeps its stroke IDs and box. [onDone] runs on the main thread with whether it was added.
     * Returns false, doing nothing, when the Document is in no Course folder, another add is still
     * running, or the mark's page isn't shown.
     */
    fun addRedMark(
        mark: RedMark,
        onDone: (added: Boolean) -> Unit,
    ): Boolean {
        val course = course
        val shown = documentPages(ink.pages, pageSizes)
        val pageIndex = shown.indexOfFirst { it.id == mark.pageId }
        if (course == null || note is RevisionLogNote.Adding || pageIndex < 0) {
            if (pageIndex < 0) AppLog.w("Add mistake from a Red mark: its page ${mark.pageId.value} isn't shown")
            return false
        }
        addRedMark(mark, course, shown[pageIndex], pageIndex + 1, onDone)
        return true
    }

    private fun addRedMark(
        mark: RedMark,
        course: CourseFolder,
        page: DocumentPage,
        pageNumber: Int,
        onDone: (added: Boolean) -> Unit,
    ) {
        val area = PageRect(0f, 0f, page.size.widthPt.toFloat(), page.size.heightPt.toFloat())
        val snip = checkNotNull(SnipRegion.of(area, page.size)) { "a whole page is on the page" }
        // Read here, on the main thread: the meshes are drawn again on the render thread.
        val strokes = ink.on(mark.pageId).map { it.mesh }
        val source = EntrySource(document.treePath, mark.pageId, pageNumber, area)
        val outline = mark.box.grownBy(RED_MARK_OUTLINE_MARGIN_PT)
        note = RevisionLogNote.Adding(course.name)
        scope.launch {
            val result =
                try {
                    val snips = renderSnips(pages, page, snip, strokes, outline)
                    added(course, EntryKind.MISTAKE, source, snips, fromMark = mark)
                } catch (e: PageRenderException) {
                    AppLog.e("Mistake not added to ${course.name} from a Red mark: its Snips couldn't be drawn", e)
                    RevisionLogNote.Failed(course.name)
                }
            note = result
            onDone(result is RevisionLogNote.Added)
        }
    }

    /** Sets the category and "why" line of the Entry just added. */
    fun edit(
        category: MistakeCategory?,
        why: String?,
    ) {
        val added = note as? RevisionLogNote.Added ?: return
        added.session.edit(added.entry.id, category, why)
        note = added.copy(entry = added.session.entries.first { it.id == added.entry.id })
        AppLog.i("Entry edited in ${added.courseName}: ${added.entry.id.value}")
    }

    fun dismiss() {
        if (note !is RevisionLogNote.Adding) note = null
    }

    private suspend fun added(
        course: CourseFolder,
        kind: EntryKind,
        source: EntrySource,
        snips: Snips,
        fromMark: RedMark? = null,
    ): RevisionLogNote =
        withContext(Dispatchers.IO) {
            val session = RevisionLogSessions.open(course.folder)
            val damaged = session.damaged
            if (damaged != null) return@withContext RevisionLogNote.LogUnreadable(course.name, damaged.reason)
            try {
                val entry = session.addEntry(kind, source, snips, fromMark?.strokeIds.orEmpty(), fromMark?.box)
                if (fromMark != null) {
                    AppLog.i("Mistake added from a Red mark to ${course.name}: ${entry.id.value}")
                } else {
                    AppLog.i("Entry added to ${course.name}: ${entry.id.value}, ${kind.name.lowercase()}")
                }
                RevisionLogNote.Added(course.name, entry, session)
            } catch (e: SnipSaveFailed) {
                AppLog.e("Entry not added to ${course.name}", e)
                RevisionLogNote.Failed(course.name)
            }
        }
}
