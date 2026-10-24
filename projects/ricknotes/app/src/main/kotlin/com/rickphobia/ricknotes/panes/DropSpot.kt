package com.rickphobia.ricknotes.panes

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect

/**
 * The Pane, of [paneBounds], that something let go at [at] lands on, or null: not the Pane [from]
 * that a Tab was dragged out of, and not one under [covered], the tree drawer drawn over the Panes.
 */
internal fun paneAt(
    paneBounds: Map<Int, Rect>,
    at: Offset,
    from: Int? = null,
    covered: Rect? = null,
): Int? {
    if (covered?.contains(at) == true) return null
    return paneBounds.entries
        .firstOrNull { it.value.contains(at) }
        ?.key
        ?.takeIf { it != from }
}
