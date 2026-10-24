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

// Side by side or stacked, two Panes keep each PDF big enough to read on the tablet.
const val MAX_PANES = 2

// Each Pane keeps at least a quarter of the screen: room for its tab bar, toolbar and a page.
const val MIN_PANE_SHARE = 0.25f
const val EQUAL_PANES = 0.5f

/**
 * The Panes and their Tabs, the [focused] Pane and the [divider] (the first Pane's share of the
 * screen, kept [MIN_PANE_SHARE] from either edge), as plain data: each operation returns the
 * changed Layout. A Tab is named by its Pane's index and its index in that Pane; naming one that
 * isn't there changes nothing.
 */
data class Layout(
    val panes: List<Pane> = emptyList(),
    val focused: Int = 0,
    val divider: Float = EQUAL_PANES,
) {
    init {
        require(panes.size <= MAX_PANES) { "a Layout has at most $MAX_PANES Panes, not ${panes.size}" }
        require((panes.isEmpty() && focused == 0) || focused in panes.indices) {
            "the Focused Pane $focused is not one of the ${panes.size}"
        }
        require(divider in MIN_PANE_SHARE..1 - MIN_PANE_SHARE) { "the divider is at $divider" }
    }

    /** The Tab showing in the Focused Pane, or null when nothing is open. */
    val selectedTab: Tab? get() = panes.getOrNull(focused)?.selectedTab

    /**
     * Opens the Document at [path] in [pane] (the Focused Pane unless named) as a new Tab at
     * [position], after the others, or selects its Tab, left where it was, if it is already open there.
     */
    fun open(
        path: String,
        position: TabPosition,
        pane: Int = focused,
    ): Layout {
        val opening = panes.getOrNull(pane) ?: return if (panes.isEmpty()) firstTab(path, position) else this
        val open = opening.tabs.indexOfFirst { it.path == path }
        val opened =
            if (open >=
                0
            ) {
                opening.copy(selected = open)
            } else {
                Pane(opening.tabs + Tab(path, position), opening.tabs.size)
            }
        return withPane(pane, opened)
    }

    /** Opens the Document at [path] like [open], but at [position] even if it is already open. */
    fun openAt(
        path: String,
        position: TabPosition,
        pane: Int = focused,
    ): Layout = open(path, position, pane).let { it.moved(pane, it.panes[pane].selected, position) }

    /**
     * Opens the Focused Pane's Document in the other Pane at the same page and zoom, making the
     * second Pane if there is only one, and focuses it there.
     */
    fun split(): Layout {
        val current = selectedTab ?: return this
        val other = (focused + 1) % MAX_PANES
        return when {
            panes.size < MAX_PANES -> copy(panes = panes + Pane(listOf(current), 0), focused = panes.size)
            else -> openAt(current.path, current.position, other).copy(focused = other)
        }
    }

    /** Makes [pane] the Focused Pane. */
    fun focus(pane: Int): Layout = if (pane in panes.indices) copy(focused = pane) else this

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
     * closing a Pane's last Tab closes the Pane and focuses the one left.
     */
    fun close(
        pane: Int,
        tab: Int,
    ): Layout {
        val closing = panes.getOrNull(pane)?.takeIf { tab in it.tabs.indices } ?: return this
        val tabs = closing.tabs.filterIndexed { index, _ -> index != tab }
        return when {
            tabs.isEmpty() -> Layout(panes.filterIndexed { index, _ -> index != pane })
            tab < closing.selected -> withPane(pane, Pane(tabs, closing.selected - 1))
            else -> withPane(pane, Pane(tabs, closing.selected.coerceAtMost(tabs.lastIndex)))
        }
    }

    private fun firstTab(
        path: String,
        position: TabPosition,
    ) = Layout(listOf(Pane(listOf(Tab(path, position)), 0)))

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
