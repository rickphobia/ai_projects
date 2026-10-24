package com.rickphobia.ricknotes.core.layout

// Arranging the two Panes by hand: the divider, and moving Tabs between them.

/** Puts the divider at [share] of the screen, or as near as the Panes' minimum allows. */
fun Layout.setDivider(share: Float): Layout = copy(divider = share.coerceIn(MIN_PANE_SHARE, 1 - MIN_PANE_SHARE))

fun Layout.makeEqual(): Layout = copy(divider = EQUAL_PANES)

/**
 * Moves a Tab to the other Pane at its position, after that Pane's Tabs (or onto its Tab of the
 * same Document), and selects and focuses it there. Moving a Pane's last Tab closes that Pane.
 */
fun Layout.moveToOtherPane(
    pane: Int,
    tab: Int,
): Layout {
    val moving =
        panes
            .getOrNull(pane)
            ?.tabs
            ?.getOrNull(tab)
            ?.takeIf { panes.size == MAX_PANES } ?: return this
    val closed = close(pane, tab)
    val target = if (closed.panes.size < MAX_PANES) 0 else (pane + 1) % MAX_PANES
    return closed.openAt(moving.path, moving.position, target).copy(focused = target, divider = closed.divider)
}
