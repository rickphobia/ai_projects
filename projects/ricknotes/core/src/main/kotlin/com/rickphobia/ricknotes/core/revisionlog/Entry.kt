package com.rickphobia.ricknotes.core.revisionlog

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.session.PageRect
import java.time.LocalDate

/** An Entry's ID: made once when it is added and never changed. It also names its Snips. */
@JvmInline
value class EntryId(
    val value: String,
)

enum class EntryKind { MISTAKE, KEY_POINT }

/** Why a Mistake went wrong. Only Mistakes have one, and it is optional. */
enum class MistakeCategory { CONCEPT, ALGEBRA, CARELESS, MISREAD, DIDNT_UNDERSTAND }

/**
 * Where an Entry came from: the Document at [documentPath] (relative to the Study folder), its page
 * [pageId] (shown as [pageNumber]), and the [area] of that page its Snips show, in page points.
 */
data class EntrySource(
    val documentPath: String,
    val pageId: PageId,
    val pageNumber: Int,
    val area: PageRect,
)

/** When an Entry is next due in Review, and the gap in days that got it there. */
data class Schedule(
    val dueDate: LocalDate,
    val gapDays: Int,
)

/** How a card went in Review. */
enum class Grade { AGAIN, GOOD }

/** One rating of an Entry in Review, at [atMs] wall-clock epoch time. */
data class Rating(
    val atMs: Long,
    val grade: Grade,
)

/**
 * One Redo of a Mistake in Review, written at [atMs] wall-clock epoch time: its [strokes], all on
 * [PAGE], in points from the writing area's top-left corner.
 */
data class Redo(
    val atMs: Long,
    val strokes: List<Stroke>,
) {
    init {
        require(strokes.isNotEmpty()) { "a Redo has strokes" }
        require(strokes.all { it.pageId == PAGE }) { "a Redo's strokes are on its own page" }
    }

    companion object {
        /** The page every Redo stroke is on: a Redo's writing area isn't a page of any Document. */
        val PAGE = PageId("redo")
    }
}

/** The two Snips of an Entry, as PNG: the area without ink (front) and with it (back). */
class Snips(
    val front: ByteArray,
    val back: ByteArray,
)

/**
 * One item in a Revision log. [addedAtMs] is wall-clock epoch time; [category] is for Mistakes
 * only; [ratings] are every rating it got in Review and [redos] every Redo written, oldest first.
 */
data class Entry(
    val id: EntryId,
    val kind: EntryKind,
    val source: EntrySource,
    val addedAtMs: Long,
    val schedule: Schedule,
    val category: MistakeCategory? = null,
    val why: String? = null,
    val ratings: List<Rating> = emptyList(),
    val redos: List<Redo> = emptyList(),
) {
    init {
        require(kind == EntryKind.MISTAKE || category == null) { "a Key point has no category" }
        require(kind == EntryKind.MISTAKE || redos.isEmpty()) { "a Key point has no Redo" }
    }
}

/** A `revision_log.json` that can't be read: never overwritten, so its Revision log opens read-only. */
class RevisionLogDamaged(
    val fileName: String,
    val reason: String,
    cause: Throwable? = null,
) : Exception("$fileName can't be read ($reason)", cause)

/** An Entry's Snip couldn't be written, so the Entry wasn't added. */
class SnipSaveFailed(
    val fileName: String,
    cause: Exception,
) : Exception("couldn't save the Snip $fileName: ${cause.message}", cause)
