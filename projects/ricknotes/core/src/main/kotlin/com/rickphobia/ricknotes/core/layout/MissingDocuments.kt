package com.rickphobia.ricknotes.core.layout

/**
 * Marks each Tab missing whose Document no longer [exists] (moved or renamed outside the app), and
 * clears the mark from one whose Document is back. Missing Tabs are kept, not dropped, so the
 * student sees what went and closes it.
 */
fun Layout.checkMissing(exists: (String) -> Boolean): Layout =
    copy(panes = panes.map { pane -> pane.copy(tabs = pane.tabs.map { it.copy(missing = !exists(it.path)) }) })
