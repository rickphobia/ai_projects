package com.rickphobia.ricknotes.ink

import com.rickphobia.ricknotes.core.ink.InkTool

/** What the pen does on the page: draw with an ink tool, erase whole strokes, or select them with the Lasso. */
internal sealed interface PenMode {
    data class Draw(
        val tool: InkTool,
    ) : PenMode

    data object Erase : PenMode

    data object Lasso : PenMode
}
