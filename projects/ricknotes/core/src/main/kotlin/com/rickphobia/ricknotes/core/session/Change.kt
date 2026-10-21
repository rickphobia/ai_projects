package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId

/** One undo step: a change to a Document's strokes that can be made and taken back. */
internal sealed interface Change {
    fun apply(strokes: MutableList<Stroke>)

    fun undo(strokes: MutableList<Stroke>)

    data class Added(
        val stroke: Stroke,
    ) : Change {
        override fun apply(strokes: MutableList<Stroke>) {
            strokes.add(stroke)
        }

        override fun undo(strokes: MutableList<Stroke>) {
            strokes.removeAll { it.id == stroke.id }
        }
    }

    /** [erased] holds each stroke with its place in the list, so undo puts it back where it was. */
    data class Erased(
        val erased: List<IndexedValue<Stroke>>,
    ) : Change {
        override fun apply(strokes: MutableList<Stroke>) {
            val ids = erased.map { it.value.id }.toSet()
            strokes.removeAll { it.id in ids }
        }

        override fun undo(strokes: MutableList<Stroke>) {
            // In ascending order, each index is right once the ones before it are back.
            erased.sortedBy { it.index }.forEach { strokes.add(it.index.coerceAtMost(strokes.size), it.value) }
        }
    }

    /** [before] holds the strokes as they were, so undo puts them back exactly, with no rounding. */
    data class Moved(
        val before: List<Stroke>,
        val offset: PageOffset,
    ) : Change {
        override fun apply(strokes: MutableList<Stroke>) =
            replace(strokes, before.associate { it.id to it.movedBy(offset) })

        override fun undo(strokes: MutableList<Stroke>) = replace(strokes, before.associateBy { it.id })

        // In place, so a moved stroke keeps its place in the drawing order.
        private fun replace(
            strokes: MutableList<Stroke>,
            byId: Map<StrokeId, Stroke>,
        ) = strokes.replaceAll { byId[it.id] ?: it }
    }
}
