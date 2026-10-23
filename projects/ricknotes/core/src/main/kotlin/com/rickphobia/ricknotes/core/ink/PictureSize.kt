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
