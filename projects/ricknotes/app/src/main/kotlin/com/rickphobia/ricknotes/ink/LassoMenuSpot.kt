package com.rickphobia.ricknotes.ink

/** A width and height on screen, in pixels. */
internal data class ScreenSize(
    val width: Float,
    val height: Float,
)

/** A rectangle on screen, in pixels; it may reach past the screen's edges. */
internal data class ScreenBox(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
)

/** Where the Lasso menu's top-left corner goes on screen, in pixels. */
internal data class MenuSpot(
    val x: Float,
    val y: Float,
)

/**
 * Where a [menu]-sized Lasso menu goes beside a selection's [box]: [gap] below it, or above it when
 * there is no room below, lined up with its left edge. It is always kept wholly on [screen], even if
 * that means covering the selection, so the pen can always reach it.
 */
internal fun lassoMenuSpot(
    box: ScreenBox,
    menu: ScreenSize,
    screen: ScreenSize,
    gap: Float,
): MenuSpot {
    val below = box.bottom + gap
    val above = box.top - gap - menu.height
    val y = if (below + menu.height <= screen.height || above < 0f) below else above
    return MenuSpot(
        x = box.left.coerceIn(0f, (screen.width - menu.width).coerceAtLeast(0f)),
        y = y.coerceIn(0f, (screen.height - menu.height).coerceAtLeast(0f)),
    )
}
