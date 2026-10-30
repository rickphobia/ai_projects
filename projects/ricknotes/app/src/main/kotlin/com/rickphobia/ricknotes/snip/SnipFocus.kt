package com.rickphobia.ricknotes.snip

import com.rickphobia.ricknotes.core.session.PageRect

/**
 * How far round a Red mark's box a Snip opens, in PDF points: past the box's outline on the back
 * Snip, with room for the question's nearby lines.
 */
internal const val SNIP_ZOOM_MARGIN_PT = 36f

/** The most a Snip zooms in past its opening zoom, so pinching in stays useful but bounded. */
internal const val SNIP_MAX_EXTRA_ZOOM = 3f

/** The part of a Snip it opens zoomed to, as fractions (0 to 1) of its width and height. */
internal data class SnipFocus(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
) {
    val centerX: Float get() = (left + right) / 2
    val centerY: Float get() = (top + bottom) / 2

    /** The zoom that fits this part in a frame the Snip's shape: 1 is the whole Snip. */
    fun fitScale(): Float = minOf(1 / (right - left), 1 / (bottom - top)).coerceAtLeast(1f)

    companion object {
        /**
         * Where [box] (page points) sits in a Snip of [area], grown by [SNIP_ZOOM_MARGIN_PT] and cut
         * to the Snip. Null when there is no box (Lasso and older Entries) or it misses the area.
         */
        fun of(
            area: PageRect,
            box: PageRect?,
        ): SnipFocus? {
            if (box == null) return null
            val width = area.right - area.left
            val height = area.bottom - area.top
            val grown = box.grownBy(SNIP_ZOOM_MARGIN_PT)
            val focus =
                SnipFocus(
                    ((grown.left - area.left) / width).coerceIn(0f, 1f),
                    ((grown.top - area.top) / height).coerceIn(0f, 1f),
                    ((grown.right - area.left) / width).coerceIn(0f, 1f),
                    ((grown.bottom - area.top) / height).coerceIn(0f, 1f),
                )
            return focus.takeIf { it.right > it.left && it.bottom > it.top }
        }
    }
}

private const val FRAME_MIDDLE = 0.5f

/**
 * [center] (a fraction of the picture, shown in the frame's middle) moved just enough that a picture
 * zoomed by [scale] about its middle still covers the frame. At scale 1 that is the whole picture.
 */
internal fun coveringCenter(
    center: Float,
    scale: Float,
): Float {
    val half = FRAME_MIDDLE / scale
    return center.coerceIn(half, 1 - half)
}

/** How far to shift a picture zoomed by [scale], as a fraction of the frame, to put [center] in its middle. */
internal fun shiftToMiddle(
    center: Float,
    scale: Float,
): Float = (FRAME_MIDDLE - center) * scale
