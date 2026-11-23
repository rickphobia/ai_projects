package com.rickphobia.ricknotes.core.presets

import com.rickphobia.ricknotes.core.export.ExportPlan
import com.rickphobia.ricknotes.core.session.DocumentSnapshot

/** How one Document of a send goes (spec, export with ink, stories 11, 13 and 17). */
sealed interface DocumentSend {
    /** The PDF as it is. [inkLeftOut] is true when ink was wanted but its Ink file can't be read. */
    data class Bare(
        val inkLeftOut: Boolean = false,
    ) : DocumentSend

    /** An Export made from [plan] goes in place of the PDF. */
    data class WithInk(
        val plan: ExportPlan.WithInk,
    ) : DocumentSend
}

/** What sending with a Preset does, decided before anything is exported or shared. */
sealed interface PresetSend {
    /** One entry per Document, in the order they go in the share. */
    data class Ready(
        val documents: List<DocumentSend>,
    ) : PresetSend {
        val inkLeftOut: Boolean get() = documents.any { it is DocumentSend.Bare && it.inkLeftOut }
        val inkGoes: Boolean get() = documents.any { it is DocumentSend.WithInk }
    }

    /** A Document waits on Keep mine or Keep the other, so nothing goes until a side is picked (story 18). */
    data object PickASideFirst : PresetSend

    companion object {
        /**
         * Plans sending [preset] with [snapshots]: one Document, or Both Panes with the one Send to
         * was opened from first. Each gets its own Export plan, with ink only when [preset] is ink on.
         * A null snapshot is a Document whose ink hasn't loaded yet: it goes bare, and an ink-on
         * Preset says its ink was left out.
         */
        fun of(
            preset: Preset,
            snapshots: List<DocumentSnapshot?>,
        ): PresetSend {
            val plans = snapshots.map { snapshot -> snapshot?.let { ExportPlan.of(it, inkWanted = preset.inkOn) } }
            if (plans.any { it == ExportPlan.PickASideFirst }) return PickASideFirst
            return Ready(
                plans.map { plan ->
                    when (plan) {
                        is ExportPlan.WithInk -> DocumentSend.WithInk(plan)
                        ExportPlan.InkUnreadable -> DocumentSend.Bare(inkLeftOut = true)
                        null -> DocumentSend.Bare(inkLeftOut = preset.inkOn)
                        ExportPlan.Bare, ExportPlan.PickASideFirst -> DocumentSend.Bare()
                    }
                },
            )
        }
    }
}
