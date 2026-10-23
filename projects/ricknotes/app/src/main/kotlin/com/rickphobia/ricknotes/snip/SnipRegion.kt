package com.rickphobia.ricknotes.snip

import com.rickphobia.ricknotes.core.session.PageRect
import com.rickphobia.ricknotes.viewer.PageSize
import com.rickphobia.ricknotes.viewer.PixelRect
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToInt

/** Snips are drawn this sharp: 4 px per PDF point is 288 dpi, sharp enough for small print. */
internal const val SNIP_PIXELS_PER_PT = 4f

/** A Snip is never longer than this on its long edge, so a full-page loop isn't a huge file. */
internal const val SNIP_MAX_LONG_EDGE_PX = 2048

/** Where a Snip comes from: [region] of its page as drawn [pageWidthPx] wide. */
internal data class SnipRegion(
    val pageWidthPx: Int,
    val region: PixelRect,
) {
    /** Pixels per PDF point at this page width, for drawing ink to match. */
    fun pixelsPerPoint(size: PageSize): Float = pageWidthPx / size.widthPt.toFloat()

    companion object {
        /**
         * The pixels a Snip of [area] on a page of [size] covers: [area] cut to the page, at
         * [SNIP_PIXELS_PER_PT] unless that would make its long edge pass [SNIP_MAX_LONG_EDGE_PX].
         * Null if no part of [area] is on the page.
         */
        fun of(
            area: PageRect,
            size: PageSize,
        ): SnipRegion? {
            val left = area.left.coerceAtLeast(0f)
            val top = area.top.coerceAtLeast(0f)
            val right = area.right.coerceAtMost(size.widthPt.toFloat())
            val bottom = area.bottom.coerceAtMost(size.heightPt.toFloat())
            if (right <= left || bottom <= top) return null
            val longEdgePt = max(right - left, bottom - top)
            val wanted = minOf(SNIP_PIXELS_PER_PT, SNIP_MAX_LONG_EDGE_PX / longEdgePt)
            // The page is drawn a whole number of pixels wide, so the scale follows from that width.
            val pageWidthPx = (size.widthPt * wanted).roundToInt().coerceAtLeast(1)
            val scale = pageWidthPx / size.widthPt.toFloat()
            val region =
                PixelRect(
                    floor(left * scale).toInt(),
                    floor(top * scale).toInt(),
                    ceil(right * scale).toInt().coerceAtMost(pageWidthPx),
                    ceil(bottom * scale).toInt().coerceAtMost(size.heightPx(pageWidthPx)),
                )
            return SnipRegion(pageWidthPx, region).takeIf { region.width > 0 && region.height > 0 }
        }
    }
}
