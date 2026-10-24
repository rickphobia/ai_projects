package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.inkfile.InkPage

/** One undo step: a change to a Document's pages, strokes or Pictures that can be made and taken back. */
internal sealed interface Change {
    fun apply(content: InkContent)

    fun undo(content: InkContent)

    /** [inserted] holds the new page with the place it goes in the page list. */
    data class PageInserted(
        val inserted: IndexedValue<InkPage>,
    ) : Change {
        override fun apply(content: InkContent) {
            val pages = content.pages
            pages.add(inserted.index.coerceAtMost(pages.size), inserted.value)
        }

        override fun undo(content: InkContent) {
            content.pages.removeAll { it.id == inserted.value.id }
        }
    }

    /**
     * An Inserted page taken out with its [strokes] and [pictures], each with its place in its list,
     * so undo brings the page and everything on it back exactly where it was.
     */
    data class PageRemoved(
        val removed: IndexedValue<InkPage>,
        val strokes: List<IndexedValue<Stroke>>,
        val pictures: List<IndexedValue<Picture>>,
    ) : Change {
        override fun apply(content: InkContent) {
            val id = removed.value.id
            content.pages.removeAll { it.id == id }
            content.strokes.removeAll { it.pageId == id }
            content.pictures.removeAll { it.pageId == id }
        }

        override fun undo(content: InkContent) {
            content.pages.putBack(listOf(removed))
            content.strokes.putBack(strokes)
            content.pictures.putBack(pictures)
        }
    }

    data class Added(
        val stroke: Stroke,
    ) : Change {
        override fun apply(content: InkContent) {
            content.strokes.add(stroke)
        }

        override fun undo(content: InkContent) {
            content.strokes.removeAll { it.id == stroke.id }
        }
    }

    /** Undo takes the Picture off the page but leaves its image in `.assets`, so redo can put it back. */
    data class Placed(
        val picture: Picture,
    ) : Change {
        override fun apply(content: InkContent) {
            content.pictures.add(picture)
        }

        override fun undo(content: InkContent) {
            content.pictures.removeAll { it.id == picture.id }
        }
    }

    /** [before] and [after] are the same Picture before and after a move or resize. */
    data class Reframed(
        val before: Picture,
        val after: Picture,
    ) : Change {
        override fun apply(content: InkContent) = content.pictures.replaceAll { if (it.id == before.id) after else it }

        override fun undo(content: InkContent) = content.pictures.replaceAll { if (it.id == after.id) before else it }
    }

    /**
     * [deleted] holds the Picture with its place in the list, so undo puts it back in the same
     * drawing order. Its image stays in `.assets`.
     */
    data class Deleted(
        val deleted: IndexedValue<Picture>,
    ) : Change {
        override fun apply(content: InkContent) {
            content.pictures.removeAll { it.id == deleted.value.id }
        }

        override fun undo(content: InkContent) {
            val pictures = content.pictures
            pictures.add(deleted.index.coerceAtMost(pictures.size), deleted.value)
        }
    }

    /** [erased] holds each stroke with its place in the list, so undo puts it back where it was. */
    data class Erased(
        val erased: List<IndexedValue<Stroke>>,
    ) : Change {
        override fun apply(content: InkContent) {
            val ids = erased.map { it.value.id }.toSet()
            content.strokes.removeAll { it.id in ids }
        }

        override fun undo(content: InkContent) = content.strokes.putBack(erased)
    }

    /** [before] holds the strokes as they were, so undo puts them back exactly, with no rounding. */
    data class Moved(
        val before: List<Stroke>,
        val offset: PageOffset,
    ) : Change {
        override fun apply(content: InkContent) =
            replace(content.strokes, before.associate { it.id to it.movedBy(offset) })

        override fun undo(content: InkContent) = replace(content.strokes, before.associateBy { it.id })

        // In place, so a moved stroke keeps its place in the drawing order.
        private fun replace(
            strokes: MutableList<Stroke>,
            byId: Map<StrokeId, Stroke>,
        ) = strokes.replaceAll { byId[it.id] ?: it }
    }
}

// Puts each item back at its old place. In ascending order, each index is right once the ones
// before it are back.
private fun <T> MutableList<T>.putBack(items: List<IndexedValue<T>>) =
    items.sortedBy { it.index }.forEach { add(it.index.coerceAtMost(size), it.value) }
