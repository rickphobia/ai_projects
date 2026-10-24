package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.PictureFrame
import com.rickphobia.ricknotes.core.ink.PictureId
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.inkfile.InkPage

/**
 * What the changes in an [InkHistory] change: a Document's pages in order, and its strokes and
 * Pictures in drawing order.
 */
internal class InkContent(
    pages: List<InkPage>,
    strokes: List<Stroke>,
    pictures: List<Picture>,
) {
    val pages = pages.toMutableList()
    val strokes = strokes.toMutableList()
    val pictures = pictures.toMutableList()
}

/**
 * A Document's pages, strokes and Pictures and the changes made to them, to step back and forward
 * through in one history. It lives only in memory, so it ends with the session. Not thread-safe:
 * the session guards it.
 *
 * One function per kind of change, so like [DocumentSession] it goes past detekt's function count.
 */
@Suppress("TooManyFunctions")
internal class InkHistory(
    private val content: InkContent,
) {
    private val strokeList = content.strokes
    private val undoSteps = ArrayDeque<Change>()
    private val redoSteps = ArrayDeque<Change>()

    val pages: List<InkPage> get() = content.pages.toList()
    val strokes: List<Stroke> get() = strokeList.toList()
    val pictures: List<Picture> get() = content.pictures.toList()
    val canUndo: Boolean get() = undoSteps.isNotEmpty()
    val canRedo: Boolean get() = redoSteps.isNotEmpty()

    fun add(stroke: Stroke): Boolean = make(Change.Added(stroke))

    /** Puts [page] right after the page [after], which must be here. */
    fun insertPage(
        page: InkPage,
        after: PageId,
    ): Boolean {
        val index = content.pages.indexOfFirst { it.id == after }
        require(index >= 0) { "page ${after.value} is not here" }
        return make(Change.PageInserted(IndexedValue(index + 1, page)))
    }

    fun hasInk(id: PageId): Boolean = strokeList.any { it.pageId == id } || content.pictures.any { it.pageId == id }

    /**
     * Takes the Inserted page [id] out with its strokes and Pictures; false, and no undo step, if it
     * isn't here. A PDF's own page can't be removed.
     */
    fun removePage(id: PageId): Boolean {
        val page = content.pages.withIndex().firstOrNull { it.value.id == id } ?: return false
        require(page.value.inserted) { "page ${id.value} is one of the PDF's own" }
        val strokes = strokeList.withIndex().filter { it.value.pageId == id }
        val pictures = content.pictures.withIndex().filter { it.value.pageId == id }
        return make(Change.PageRemoved(page, strokes, pictures))
    }

    fun place(picture: Picture): Boolean = make(Change.Placed(picture))

    /** False, and no undo step, if the Picture isn't here or is at [frame] already. */
    fun reframe(
        id: PictureId,
        frame: PictureFrame,
    ): Boolean {
        val before = content.pictures.firstOrNull { it.id == id } ?: return false
        val after = before.copy(left = frame.left, top = frame.top, widthPt = frame.widthPt, heightPt = frame.heightPt)
        return after != before && make(Change.Reframed(before, after))
    }

    /** False, and no undo step, if the Picture isn't here. */
    fun delete(id: PictureId): Boolean {
        val deleted = content.pictures.withIndex().firstOrNull { it.value.id == id } ?: return false
        return make(Change.Deleted(deleted))
    }

    /** False, and no undo step, if none of [ids] is here. */
    fun erase(ids: Set<StrokeId>): Boolean {
        val erased = strokeList.withIndex().filter { it.value.id in ids }
        return erased.isNotEmpty() && make(Change.Erased(erased))
    }

    /** False, and no undo step, if none of [ids] is here or [offset] is zero. */
    fun move(
        ids: Set<StrokeId>,
        offset: PageOffset,
    ): Boolean {
        val moving = strokeList.filter { it.id in ids }
        return moving.isNotEmpty() && !offset.isZero && make(Change.Moved(moving, offset))
    }

    fun undo(): Boolean {
        val change = undoSteps.removeLastOrNull() ?: return false
        change.undo(content)
        redoSteps.add(change)
        return true
    }

    fun redo(): Boolean {
        val change = redoSteps.removeLastOrNull() ?: return false
        change.apply(content)
        undoSteps.add(change)
        return true
    }

    private fun make(change: Change): Boolean {
        change.apply(content)
        undoSteps.add(change)
        redoSteps.clear()
        return true
    }
}
