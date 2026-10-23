package com.rickphobia.ricknotes.core.ink

/** A Picture's place on its page, in PDF points: what [fitPicture] works out for a drop. */
data class PictureFrame(
    val left: Float,
    val top: Float,
    val widthPt: Float,
    val heightPt: Float,
)

// A dropped image takes at most this share of the page's width and of its height, so it lands
// beside the question instead of covering it.
private const val MAX_PAGE_SHARE = 0.5f

// A small image is never blown up past one pixel per point, so it isn't blurry.
private const val MAX_POINTS_PER_PIXEL = 1f

/**
 * Where an image [widthPx] x [heightPx] dropped at [centre] goes on a [pageWidthPt] x [pageHeightPt]
 * page: keeping its shape, at most half the page wide and half the page tall, centred where it was
 * let go and moved in so it is wholly on the page.
 */
fun fitPicture(
    widthPx: Int,
    heightPx: Int,
    centre: PagePoint,
    pageWidthPt: Float,
    pageHeightPt: Float,
): PictureFrame {
    require(widthPx > 0 && heightPx > 0) { "image is ${widthPx}x$heightPx" }
    val scale =
        minOf(
            pageWidthPt * MAX_PAGE_SHARE / widthPx,
            pageHeightPt * MAX_PAGE_SHARE / heightPx,
            MAX_POINTS_PER_PIXEL,
        )
    val width = widthPx * scale
    val height = heightPx * scale
    return PictureFrame(
        left = (centre.x - width / 2).coerceIn(0f, pageWidthPt - width),
        top = (centre.y - height / 2).coerceIn(0f, pageHeightPt - height),
        widthPt = width,
        heightPt = height,
    )
}

// A Picture is never shrunk below this on its short side, in points, so it can still be tapped.
private const val MIN_PICTURE_PT = 20f

/**
 * [frame] resized by dragging its bottom-right corner to [corner] on a [pageWidthPt] x [pageHeightPt]
 * page: its top-left corner stays put, it keeps its shape, it stays on the page and it is never
 * smaller than [MIN_PICTURE_PT] on its short side.
 */
fun resizedPicture(
    frame: PictureFrame,
    corner: PagePoint,
    pageWidthPt: Float,
    pageHeightPt: Float,
): PictureFrame {
    // Follows whichever side the pen pulls further, so the corner never lags behind the pen.
    val wanted = maxOf((corner.x - frame.left) / frame.widthPt, (corner.y - frame.top) / frame.heightPt)
    val smallest = MIN_PICTURE_PT / minOf(frame.widthPt, frame.heightPt)
    val largest = minOf((pageWidthPt - frame.left) / frame.widthPt, (pageHeightPt - frame.top) / frame.heightPt)
    val scale = wanted.coerceAtMost(largest).coerceAtLeast(smallest)
    return frame.copy(widthPt = frame.widthPt * scale, heightPt = frame.heightPt * scale)
}
