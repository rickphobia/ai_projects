package com.rickphobia.ricknotes.viewer

import com.rickphobia.ricknotes.core.ink.PagePlacement

/**
 * Where each page on screen is right now, for turning pen positions into page points. Pages sit
 * [gapPx] in from the zoomed list's left edge, and the list is slid [ZoomView.panX] to the left.
 * A laid-out page that [pages] no longer has (just removed) is left out.
 */
internal fun pagePlacements(
    visible: List<VisiblePage>,
    pages: List<DocumentPage>,
    pageWidthPx: Int,
    gapPx: Int,
    view: ZoomView,
): List<PagePlacement> =
    visible.mapNotNull { visiblePage ->
        val page = pages.getOrNull(visiblePage.index) ?: return@mapNotNull null
        val size = page.size
        PagePlacement(
            pageId = page.id,
            left = gapPx - view.panX,
            top = visiblePage.top.toFloat(),
            pixelsPerPoint = pageWidthPx.toFloat() / size.widthPt,
            widthPt = size.widthPt.toFloat(),
            heightPt = size.heightPt.toFloat(),
        )
    }
