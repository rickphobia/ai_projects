package com.rickphobia.ricknotes.core.layout

import com.rickphobia.ricknotes.core.studyfolder.renamedPath

/**
 * Every Tab of the Document at [from], or of a Document inside the folder at [from], follows it
 * to [to] with its page and zoom. Renamed in the app, so it is no longer missing.
 */
fun Layout.renamed(
    from: String,
    to: String,
): Layout =
    copy(
        panes =
            panes.map { pane ->
                pane.copy(tabs = pane.tabs.map { tab -> tab.renamed(from, to) })
            },
    )

private fun Tab.renamed(
    from: String,
    to: String,
): Tab = renamedPath(path, from, to)?.let { copy(path = it, missing = false) } ?: this
