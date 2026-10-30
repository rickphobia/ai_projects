package com.rickphobia.ricknotes.core.layout

/**
 * The Tab shown in the Pane other than [pane], when Send to can send Both Panes: there are two
 * Panes, their selected Tabs are different Documents, and the other one isn't missing. Otherwise null.
 */
fun Layout.otherPaneDocument(pane: Int): Tab? {
    if (panes.size < MAX_PANES || pane !in panes.indices) return null
    val mine = panes[pane].selectedTab
    val other = panes[(pane + 1) % MAX_PANES].selectedTab
    return other.takeIf { it.path != mine.path && !it.missing }
}
