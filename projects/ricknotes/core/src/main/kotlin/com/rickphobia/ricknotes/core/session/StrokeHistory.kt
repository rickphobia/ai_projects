package com.rickphobia.ricknotes.core.session

import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId

/**
 * A Document's strokes and the changes made to them, to step back and forward through. The history
 * lives only in memory, so it ends with the session. Not thread-safe: the session guards it.
 */
internal class StrokeHistory(
    loaded: List<Stroke>,
) {
    private val strokeList = loaded.toMutableList()
    private val undoSteps = ArrayDeque<Change>()
    private val redoSteps = ArrayDeque<Change>()

    val strokes: List<Stroke> get() = strokeList.toList()
    val canUndo: Boolean get() = undoSteps.isNotEmpty()
    val canRedo: Boolean get() = redoSteps.isNotEmpty()

    fun add(stroke: Stroke): Boolean = make(Change.Added(stroke))

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
        change.undo(strokeList)
        redoSteps.add(change)
        return true
    }

    fun redo(): Boolean {
        val change = redoSteps.removeLastOrNull() ?: return false
        change.apply(strokeList)
        undoSteps.add(change)
        return true
    }

    private fun make(change: Change): Boolean {
        change.apply(strokeList)
        undoSteps.add(change)
        redoSteps.clear()
        return true
    }
}
