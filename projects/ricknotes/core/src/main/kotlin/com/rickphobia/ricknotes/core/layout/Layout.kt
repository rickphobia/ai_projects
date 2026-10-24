package com.rickphobia.ricknotes.core.layout

/** Where a Tab shows its Document: the page across the middle of the Pane, and the zoom. */
data class TabPosition(
    val pageIndex: Int,
    val zoom: Float,
)

/** One open Document: its path relative to the Study folder, and where it is being read. */
data class Tab(
    val path: String,
    val position: TabPosition,
)

/** One Pane: its Tabs in tab-bar order, never empty, and which one shows. */
data class Pane(
    val tabs: List<Tab>,
    val selected: Int,
) {
    init {
        require(tabs.isNotEmpty()) { "a Pane has at least one Tab" }
        require(selected in tabs.indices) { "the selected Tab $selected is not one of the ${tabs.size}" }
    }

    val selectedTab: Tab get() = tabs[selected]
}

/**
 * The Panes and their Tabs, as plain data: each operation returns the changed Layout. A Tab is
 * named by its Pane's index and its index in that Pane; naming one that isn't there changes nothing.
 */
data class Layout(
    val panes: List<Pane> = emptyList(),
) {
    /** The Tab showing in the first Pane, or null when nothing is open. */
    val selectedTab: Tab? get() = panes.firstOrNull()?.selectedTab

    /**
     * Opens the Document at [path] in the first Pane as a new Tab at [position], after the others,
     * or selects its Tab, left where it was, if it is already open there.
     */
    fun open(
        path: String,
        position: TabPosition,
    ): Layout {
        val pane = panes.firstOrNull() ?: return copy(panes = listOf(Pane(listOf(Tab(path, position)), 0)))
        val open = pane.tabs.indexOfFirst { it.path == path }
        val opened =
            if (open >=
                0
            ) {
                pane.copy(selected = open)
            } else {
                Pane(pane.tabs + Tab(path, position), pane.tabs.size)
            }
        return withPane(0, opened)
    }

    /** Opens the Document at [path] like [open], but at [position] even if it is already open. */
    fun openAt(
        path: String,
        position: TabPosition,
    ): Layout = open(path, position).let { it.moved(0, it.panes[0].selected, position) }

    fun select(
        pane: Int,
        tab: Int,
    ): Layout = changing(pane, tab) { copy(selected = tab) }

    /** Records that the Tab now shows [position]. */
    fun moved(
        pane: Int,
        tab: Int,
        position: TabPosition,
    ): Layout =
        changing(pane, tab) {
            copy(tabs = tabs.toMutableList().apply { set(tab, tabs[tab].copy(position = position)) })
        }

    /**
     * Closes a Tab. The one that takes its place is selected, or the one before it when it was last;
     * closing a Pane's last Tab closes the Pane.
     */
    fun close(
        pane: Int,
        tab: Int,
    ): Layout {
        val closing = panes.getOrNull(pane)?.takeIf { tab in it.tabs.indices } ?: return this
        val tabs = closing.tabs.filterIndexed { index, _ -> index != tab }
        return when {
            tabs.isEmpty() -> copy(panes = panes.filterIndexed { index, _ -> index != pane })
            tab < closing.selected -> withPane(pane, Pane(tabs, closing.selected - 1))
            else -> withPane(pane, Pane(tabs, closing.selected.coerceAtMost(tabs.lastIndex)))
        }
    }

    private fun changing(
        pane: Int,
        tab: Int,
        change: Pane.() -> Pane,
    ): Layout {
        val changing = panes.getOrNull(pane)?.takeIf { tab in it.tabs.indices } ?: return this
        return withPane(pane, changing.change())
    }

    private fun withPane(
        index: Int,
        pane: Pane,
    ) = copy(panes = panes.toMutableList().apply { set(index, pane) })
}
